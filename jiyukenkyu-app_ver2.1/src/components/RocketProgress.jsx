import Ruby from './Ruby';

export default function RocketProgress({ currentIndex, steps }) {
  if (currentIndex < 0) return null;

  return (
    <div className="rocket-rail">
      <div className="rocket-track">
        {steps.map((step, i) => {
          const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'todo';
          return (
            <div className={`rocket-stop rocket-stop--${state}`} key={step.key}>
              <div className="rocket-stop-dot">
                {state === 'done' ? '⭐' : step.emoji}
              </div>
              <div className="rocket-stop-label"><Ruby>{step.label}</Ruby></div>
              {state === 'active' && <div className="rocket-ship">🚀</div>}
            </div>
          );
        })}
      </div>
      <div className="rocket-progress-text">
        {currentIndex + 1} / {steps.length} すすんだよ！
      </div>
    </div>
  );
}
