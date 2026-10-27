# Phase H plan (plan only, no code written)

Goals from Louie: more 3D, less Five Nights at Freddy's, Resident Evil style hard puzzles. Constraints: keep the 10-minute cap, nights 1-5, lore, 3-beat scares, config-driven manifest, open-source only, screenshots in `docs/phase-H/`.

1. **RE-style puzzles (`js/puzzles.js`), first.** Cheapest and biggest payoff, no new engine needed. Inventory, examine, combine; keys and crests, locked doors, multi-room chains; notes and files drawn from the lore; red herrings; ink-ribbon-like limited saves; backtracking; time pressure; almost no hints; difficulty rising per night. Feasible on the current attic plus camera rooms. Risk: a 10-minute cap limits chain length, so each night is one tight chain.
2. **Break the FNAF formula.** Free-look and room navigation via hotspots, pickup items, camcorder/flashlight with battery as the framing device, Art stalking the player between rooms instead of only camera-watching. Needs more room plates (generated or supplied). Risk: the room-art budget, so reuse plates with different hotspots.
3. **More 3D.** A-Frame parallax and layers, lighting, fog and dust, DOF and vignette, Art as a 3D billboard or low-poly model, a diegetic 3D monitor. Feasible with A-Frame 1.8. Risk: iOS Safari performance, so it needs a low-quality fallback toggle in the manifest.

Order is deliberate: puzzles carry the gameplay, navigation gives them space, 3D polishes it last.
