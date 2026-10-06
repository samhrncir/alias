interface Props {
  checked: boolean
  onChange: () => void
  label: string
}

export function Switch({ checked, onChange, label }: Props) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={onChange} />
}
