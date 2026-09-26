export default async function run(page, ui) {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      if (text.includes('.map')) return
      errors.push(text)
    }
  })

  await page.waitForTimeout(1500)

  const snap1 = await ui.snapshot()
  const tripBtn = snap1.match(/@(e\d+) button "Modo Viaje"/)?.[1]
    || snap1.match(/@(e\d+) button "[^"]*[Vv]iaje[^"]*"/)?.[1]
  if (!tripBtn) {
    return { stage: 'open-trip', error: 'no Modo Viaje button', snapshot: snap1.slice(0, 2000), errors }
  }

  await ui.click(tripBtn)
  await page.waitForTimeout(700)

  let snap2 = await ui.snapshot()
  let destBtn = snap2.match(/@(e\d+) button "[^"]*A dónde vas[^"]*"/)?.[1]
    || snap2.match(/@(e\d+) button "[^"]*destino[^"]*"/)?.[1]
  if (!destBtn) {
    return { stage: 'find-dest-btn', error: 'no dest button', snapshot: snap2.slice(0, 3000), errors }
  }

  await ui.click(destBtn)
  await page.waitForTimeout(500)

  const snap3 = await ui.snapshot()
  let destInput = snap3.match(/@(e\d+) (?:textbox|searchbox|combobox) "[^"]*(?:destino|Destino|cabildo|buscar)[^"]*"/)?.[1]
    || snap3.match(/@(e\d+) (?:textbox|searchbox|combobox)(?: \[.*\])?/)?.[1]

  if (!destInput) {
    return { stage: 'find-input', error: 'no textbox after expand', snapshot: snap3.slice(0, 3000), errors }
  }

  await ui.fill(destInput, 'cabildo')
  await page.waitForTimeout(1000)

  const snap4 = await ui.snapshot()
  const cabildoOpt = snap4.match(/@(e\d+) [a-z]+ "[^"]*Cabildo[^"]*"/)?.[1]
    || snap4.match(/@(e\d+) [a-z]+ "[^"]*cabildo[^"]*"/)?.[1]

  if (cabildoOpt) {
    await ui.click(cabildoOpt)
    await page.waitForTimeout(1500)
  }

  const snap5 = await ui.snapshot({ full: true })
  const hasPlanner = /parcial|directo|minuto|Línea|Linea|ruta|transfer|viaje/i.test(snap5)
  const hasErrorPanel = /error|falló|no se pudo/i.test(snap5)

  return {
    ok: true,
    pickedOption: !!cabildoOpt,
    plannerVisible: hasPlanner,
    hasErrorPanel,
    errorCount: errors.length,
    errors: errors.slice(0, 10),
    treeSnippet: snap5.slice(0, 3000)
  }
}
