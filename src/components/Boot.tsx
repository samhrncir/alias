export function Boot() {
  return (
    <div className="boot" role="status" aria-label="Loading">
      <span className="logo logo-xl" data-text="ALIAS">
        ALIAS
      </span>
      <p className="boot-line">
        establishing uplink<span className="cursor">_</span>
      </p>
    </div>
  )
}
