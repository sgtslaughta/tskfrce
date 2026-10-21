import { useState } from 'react'
import { Button, Drawer } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import type { Kid } from '@/v2/types'
import { KidEditor } from './KidEditor'

/** Kid list; each opens KidEditor in a drawer. "Add a kid" opens it empty. */
export function KidsSection({ kids }: { kids: Kid[] }) {
  const small = useMediaQuery('(max-width: 767px)')
  const [open, setOpen] = useState<{ kid?: Kid } | null>(null)
  const close = () => setOpen(null)
  return (
    <>
      <div className="f-title-row">
        <h2 className="f-display">Kids</h2>
        <Button onClick={() => setOpen({})}>Add a kid</Button>
      </div>
      <div className="f-card m-list">
        {kids.map((k) => (
          <button key={k.id} type="button" className="m-row" onClick={() => setOpen({ kid: k })}>
            <span>
              {k.avatar ?? ''} <b style={{ display: 'inline' }}>{k.full_name ?? k.username}</b>
            </span>
            <span className="m-meta">{k.has_pin ? 'PIN set' : 'No PIN'}</span>
          </button>
        ))}
      </div>
      <Drawer opened={open !== null} onClose={close} position="right" size={small ? '100%' : 'md'} title={open?.kid ? 'Edit kid' : 'Add a kid'}>
        <KidEditor key={open?.kid?.id ?? 'new'} kid={open?.kid} onDone={close} />
      </Drawer>
    </>
  )
}
