import { Check, Clock3, LockKeyhole } from 'lucide-react';
import Brand from '../../shared/ui/Brand';
import type { loginCopy } from './loginCopy';

type Copy = (typeof loginCopy)['en'];
const icons = [LockKeyhole, Check, Clock3];

export default function LoginVisual({ copy }: { copy: Copy }) {
  return (
    <section className="loginVisual" aria-label="AutoOps">
      <Brand size={34} />
      <div className="loginPitch">
        <h2>{copy.headline}</h2>
        <p>{copy.summary}</p>
        <ul>
          {copy.points.map((point, index) => {
            const Icon = icons[index];
            return <li key={point}><span><Icon /></span>{point}</li>;
          })}
        </ul>
      </div>
      <div className="environmentStatus" dir="ltr">
        <i aria-hidden="true" /> {copy.environment}
      </div>
    </section>
  );
}
