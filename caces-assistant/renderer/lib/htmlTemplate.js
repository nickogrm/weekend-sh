export function generateEmailHtml({ sessionMetadata, summary }) {
  const { title, category, trainerName, date } = sessionMetadata

  const keyPointsHtml = (summary.keyPoints || []).map(kp => `
    <div class="key-point">
      <strong>${escapeHtml(kp.topic)}</strong>
      <p>${escapeHtml(kp.content)}</p>
      ${kp.regulation ? `<span class="regulation">${escapeHtml(kp.regulation)}</span>` : ''}
    </div>
  `).join('')

  const listHtml = (items = []) =>
    items.map(item => `<li>${escapeHtml(item)}</li>`).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Compte-rendu formation ${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; color: #1a1a2e; background: #fff; max-width: 800px; margin: 0 auto; padding: 32px; }
  .header { background: linear-gradient(135deg, #0a0a0f 0%, #141428 100%); color: white; padding: 32px; border-radius: 12px; margin-bottom: 32px; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
  .header .meta { opacity: 0.7; font-size: 14px; }
  .header .meta span { margin-right: 16px; }
  h2 { font-size: 16px; color: #0080ff; border-bottom: 2px solid #e8f0fe; padding-bottom: 8px; margin: 24px 0 12px; }
  p { line-height: 1.6; color: #333; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; line-height: 1.5; }
  .key-point { margin-bottom: 16px; padding: 16px; border-left: 3px solid #0080ff; background: #f0f7ff; border-radius: 0 8px 8px 0; }
  .key-point strong { display: block; color: #0a0a0f; margin-bottom: 6px; }
  .key-point p { color: #444; font-size: 14px; }
  .regulation { display: inline-block; background: #0080ff; color: white; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  .highlight-box { background: #f0f7ff; border: 1px solid #c3dafe; border-radius: 8px; padding: 20px; margin: 12px 0; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #888; font-size: 12px; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <span>📋 ${escapeHtml(category)}</span>
      <span>👤 ${escapeHtml(trainerName)}</span>
      <span>📅 ${escapeHtml(date)}</span>
    </div>
  </div>

  <h2>Résumé de la session</h2>
  <p>${escapeHtml(summary.executiveSummary || '')}</p>

  ${(summary.pedagogicalObjectives || []).length > 0 ? `
  <h2>Objectifs pédagogiques</h2>
  <ul>${listHtml(summary.pedagogicalObjectives)}</ul>
  ` : ''}

  ${(summary.keyPoints || []).length > 0 ? `
  <h2>Points clés abordés</h2>
  ${keyPointsHtml}
  ` : ''}

  ${(summary.evaluationPoints || []).length > 0 ? `
  <h2>Points d'évaluation</h2>
  <ul>${listHtml(summary.evaluationPoints)}</ul>
  ` : ''}

  ${(summary.practicalExercises || []).length > 0 ? `
  <h2>Exercices pratiques</h2>
  <ul>${listHtml(summary.practicalExercises)}</ul>
  ` : ''}

  ${(summary.recommendations || []).length > 0 ? `
  <h2>Recommandations</h2>
  <div class="highlight-box">
    <ul>${listHtml(summary.recommendations)}</ul>
  </div>
  ` : ''}

  <div class="footer">
    Ce compte-rendu a été généré automatiquement par CACES Assistant<br>
    ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>
</body>
</html>`
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
