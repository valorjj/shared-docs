import { Tabs } from '../../../components/ui'
import { CALC_MODES, CALC_MODE_LABELS, type CalcMode } from '../types'

type Props = {
  value: CalcMode
  onChange: (m: CalcMode) => void
}

export default function ModeTabs({ value, onChange }: Props) {
  return (
    <Tabs<CalcMode>
      items={CALC_MODES.map((m) => ({ key: m, label: CALC_MODE_LABELS[m] }))}
      value={value}
      onChange={onChange}
    />
  )
}
