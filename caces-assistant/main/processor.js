const fs = require('fs/promises')
const { createReadStream } = require('fs')
const path = require('path')
const { app } = require('electron')
const ffmpegStatic = require('ffmpeg-static')
const ffmpeg = require('fluent-ffmpeg')
const { OpenAI } = require('openai')
const { getSessionDir, readSession, updateSession } = require('./recorder')

function getFfmpegPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'ffmpeg')
  }
  return ffmpegStatic
}

const WHISPER_MAX_BYTES = 24 * 1024 * 1024

class Processor {
  constructor({ openaiApiKey, mainWindow }) {
    this.openai = new OpenAI({ apiKey: openaiApiKey })
    this.mainWindow = mainWindow
    this.aborted = false
    ffmpeg.setFfmpegPath(getFfmpegPath())
  }

  emit(step, progress, message) {
    this.mainWindow?.webContents.send('process:progress', { step, progress, message })
  }

  async run(sessionId) {
    this.aborted = false
    const sessionDir = getSessionDir(sessionId)
    const session = await readSession(sessionId)

    this.emit('audio', 5, 'Fusion des fichiers audio...')
    const mergedAudioPath = await this.mergeAudioChunks(sessionDir)
    if (this.aborted) return

    this.emit('transcription', 20, 'Transcription en cours via Whisper...')
    const transcript = await this.transcribeAudio(mergedAudioPath)
    if (this.aborted) return

    this.emit('vision', 50, 'Analyse des diapositives...')
    const slideAnalysis = await this.analyzeScreenshots(sessionDir)
    if (this.aborted) return

    this.emit('summary', 75, 'Génération du résumé...')
    const summary = await this.generateSummary({ session, transcript, slideAnalysis })
    if (this.aborted) return

    this.emit('saving', 95, 'Sauvegarde des résultats...')
    await updateSession(sessionId, {
      status: 'processed',
      transcript,
      slideAnalysis,
      summary,
      processedAt: new Date().toISOString(),
    })

    this.emit('complete', 100, 'Traitement terminé !')
    this.mainWindow?.webContents.send('process:complete', { sessionId, summary })
  }

  async mergeAudioChunks(sessionDir) {
    const audioDir = path.join(sessionDir, 'audio')
    let files
    try {
      files = (await fs.readdir(audioDir)).filter(f => f.endsWith('.webm')).sort()
    } catch {
      files = []
    }

    const outPath = path.join(sessionDir, 'audio.mp3')

    if (files.length === 0) {
      await fs.writeFile(outPath, Buffer.alloc(0))
      return outPath
    }

    if (files.length === 1) {
      await this.convertToMp3(path.join(audioDir, files[0]), outPath)
      return outPath
    }

    const concatList = path.join(sessionDir, 'concat.txt')
    const listContent = files
      .map(f => `file '${path.join(audioDir, f).replace(/\\/g, '/').replace(/'/g, "'\\''")}' `)
      .join('\n')
    await fs.writeFile(concatList, listContent)

    const mergedWebm = path.join(sessionDir, 'merged.webm')
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatList)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(mergedWebm)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    await this.convertToMp3(mergedWebm, outPath)
    return outPath
  }

  async convertToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate('64k')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })
  }

  async transcribeAudio(audioPath) {
    try {
      const stats = await fs.stat(audioPath)
      if (stats.size === 0) return { text: '', segments: [] }

      if (stats.size <= WHISPER_MAX_BYTES) {
        return this.transcribeFile(audioPath)
      }
      return this.transcribeInChunks(audioPath)
    } catch {
      return { text: '', segments: [] }
    }
  }

  async transcribeFile(audioPath) {
    const response = await this.openai.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model: 'whisper-1',
      language: 'fr',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    })
    return response
  }

  async transcribeInChunks(audioPath) {
    const chunkDir = path.dirname(audioPath)
    const chunkPattern = path.join(chunkDir, 'chunk-%03d.mp3')

    await new Promise((resolve, reject) => {
      ffmpeg(audioPath)
        .outputOptions(['-f', 'segment', '-segment_time', '1200', '-reset_timestamps', '1'])
        .output(chunkPattern)
        .on('end', resolve)
        .on('error', reject)
        .run()
    })

    const chunkFiles = (await fs.readdir(chunkDir))
      .filter(f => f.match(/^chunk-\d+\.mp3$/))
      .sort()

    const texts = []
    for (const chunk of chunkFiles) {
      const result = await this.transcribeFile(path.join(chunkDir, chunk))
      texts.push(result.text || '')
    }

    return { text: texts.join(' '), segments: [] }
  }

  async analyzeScreenshots(sessionDir) {
    const screenshotsDir = path.join(sessionDir, 'screenshots')
    let files
    try {
      files = (await fs.readdir(screenshotsDir)).filter(f => f.endsWith('.png')).sort()
    } catch {
      return []
    }

    if (files.length === 0) return []

    const analyses = []
    const BATCH_SIZE = 4

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      if (this.aborted) break
      const batch = files.slice(i, i + BATCH_SIZE)

      const imageContents = await Promise.all(
        batch.map(async (file) => {
          const data = await fs.readFile(path.join(screenshotsDir, file))
          return {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${data.toString('base64')}`,
              detail: 'low',
            },
          }
        })
      )

      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 1200,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyse ces captures de diapositives de formation CACES/sécurité.\nPour chaque diapositive, extrais en JSON :\n{\n  "slides": [\n    {\n      "index": 0,\n      "title": "titre",\n      "keyPoints": ["point 1", "point 2"],\n      "regulations": ["R489"],\n      "warnings": ["danger important"]\n    }\n  ]\n}\nSi la diapositive n'est pas lisible, mets title: null et hasText: false.`,
              },
              ...imageContents,
            ],
          }],
        })

        let content = response.choices[0].message.content
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          analyses.push(...(parsed.slides || []))
        }
      } catch (err) {
        console.error('Slide analysis batch error:', err.message)
      }

      const slidesDone = Math.min(i + BATCH_SIZE, files.length)
      this.emit('vision', 50 + (slidesDone / files.length) * 20,
        `Analyse des diapositives ${slidesDone}/${files.length}...`)
    }

    return analyses
  }

  async generateSummary({ session, transcript, slideAnalysis }) {
    const transcriptText = typeof transcript === 'string'
      ? transcript
      : (transcript?.text || '(pas de transcription disponible)')

    const slideSummary = slideAnalysis.length > 0
      ? JSON.stringify(slideAnalysis, null, 2)
      : '(pas de diapositives capturées)'

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 3000,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Tu es un expert en formations CACES, habilitations électriques et sécurité industrielle.\nTu rédiges des comptes-rendus de formation en français, clairs, factuels et structurés.\nStyle: professionnel, direct. Paragraphes courts. Pas de formulations creuses.`,
        },
        {
          role: 'user',
          content: `FORMATION: "${session.metadata.title}"\nCATÉGORIE: ${session.metadata.category}\nFORMATEUR: ${session.metadata.trainerName}\nDATE: ${session.metadata.date}\n\nTRANSCRIPTION AUDIO:\n${transcriptText}\n\nCONTENU DES DIAPOSITIVES:\n${slideSummary}\n\nGénère un compte-rendu structuré. Réponds UNIQUEMENT en JSON valide :\n{\n  "executiveSummary": "résumé en 2-3 phrases",\n  "pedagogicalObjectives": ["objectif 1", "objectif 2"],\n  "keyPoints": [\n    { "topic": "sujet", "content": "explication", "regulation": "référence réglementaire ou null" }\n  ],\n  "practicalExercises": ["exercice 1"],\n  "evaluationPoints": ["point d\'évaluation 1"],\n  "recommendations": ["recommandation 1"]\n}`,
        }
      ]
    })

    const content = response.choices[0].message.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return {
      executiveSummary: content,
      pedagogicalObjectives: [],
      keyPoints: [],
      practicalExercises: [],
      evaluationPoints: [],
      recommendations: [],
    }
  }

  abort() {
    this.aborted = true
  }
}

module.exports = { Processor }
