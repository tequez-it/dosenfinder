import { Header } from '../components/Header';
import { CoordsEditor } from '../components/CoordsEditor';
import { usePosition } from '../hooks/usePosition';

interface Props {
  onBack: () => void;
  onGo: (lat: number, lon: number) => void;
}

/** "Gehe zu" wie in c:geo: zu einer beliebigen Koordinate navigieren, ohne Cache. */
export function GotoScreen({ onBack, onGo }: Props) {
  const position = usePosition();
  const pos = position.status === 'ok' ? position.pos : null;
  return (
    <div class="screen">
      <Header title="Gehe zu" subtitle="Beliebige Koordinate ansteuern" onBack={onBack} />
      <div class="content">
        <CoordsEditor
          initial={null}
          base={pos ?? { lat: 0, lon: 0 }}
          baseLabel={pos ? 'Mein Standort' : 'Nullpunkt'}
          pos={null}
          saveLabel="Navigieren"
          onCancel={onBack}
          onSave={(c) => onGo(c.lat, c.lon)}
        />
        {!pos && <p class="nav-hint">Für die Projektion vom eigenen Standort wird GPS gebraucht.</p>}
      </div>
    </div>
  );
}
