/**
 * BackgroundFx — the animated backdrop behind the glass UI.
 *
 * Slowly drifting colour orbs, a faint dot grid that fades out toward the
 * bottom, and a light film-grain layer. Everything is purely decorative,
 * pointer-events: none, and sits behind the app (z-index -1).
 */
function BackgroundFx() {
  return (
    <div aria-hidden="true" className="bg-fx">
      <span className="bg-fx__orb bg-fx__orb--1" />
      <span className="bg-fx__orb bg-fx__orb--2" />
      <span className="bg-fx__orb bg-fx__orb--3" />
      <span className="bg-fx__orb bg-fx__orb--4" />
      <span className="bg-fx__grid" />
      <span className="bg-fx__grain" />
    </div>
  )
}

export default BackgroundFx
