import { useState, type MouseEvent } from 'react';
import { Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface Props {
  className?: string;
}

export function ReyInfoButton({ className = '' }: Props) {
  const [open, setOpen] = useState(false);

  const handleOpen = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Cómo se juega Rey de Cancha"
        className={`inline-flex items-center justify-center p-1 rounded-full text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer ${className}`}
      >
        <Info className="h-4 w-4" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="🎾 Rey de Cancha — cómo se juega">
        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <p>
            En el <strong>Rey de Cancha</strong> las parejas son fijas todo el torneo: con tu compañero hasta el final. Lo que cambia ronda a ronda es <strong>en qué cancha jugás</strong> — y eso depende de cómo te va en cada partido.
          </p>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Las canchas están ordenadas</h4>
            <p>Las canchas forman una "escalera":</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li>Una es la <strong>cancha de ganadores</strong>.</li>
              <li>Otra es la <strong>cancha de perdedores</strong>.</li>
              <li>Las del medio son las de tránsito.</li>
            </ul>
            <p className="mt-1">El objetivo del juego es subir hacia la cancha de ganadores y mantenerse ahí.</p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Cómo se mueven las parejas</h4>
            <p>Después de cada partido:</p>
            <ul className="list-disc list-inside space-y-0.5 mt-1">
              <li>Si <strong>ganás</strong>, subís una cancha hacia la de ganadores.</li>
              <li>Si <strong>perdés</strong>, bajás una cancha hacia la de perdedores.</li>
              <li>Si ganás y ya estabas en la cancha de ganadores, te quedás ahí (defendés el trono 👑).</li>
              <li>Si perdés y ya estabas en la cancha de perdedores, también te quedás (te toca remar).</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Cada ronda</h4>
            <p>
              En cada ronda se juega <strong>un partido por cancha</strong> (2 parejas por cancha). Si hay más parejas que lugares, las que sobran <strong>descansan</strong> esa ronda — van rotando para que todas jueguen.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">¿Se pueden repetir los rivales?</h4>
            <p>
              Sí, y es parte del juego. Si vos y otra pareja oscilan entre las mismas canchas, van a volver a cruzarse. No es un error, es la dinámica.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">¿Cuándo termina el torneo?</h4>
            <p>
              No hay una cantidad fija de rondas: el torneo sigue el tiempo que decida el organizador. Al final, las posiciones las da la tabla (puntos por partidos ganados, diferencia de sets y games).
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Tips</h4>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Ganar un partido te acerca al podio, pero un mal partido te hace bajar: cada ronda cuenta.</li>
              <li>Revisá siempre tu cancha en la pestaña <strong>Rondas</strong> antes de empezar.</li>
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
