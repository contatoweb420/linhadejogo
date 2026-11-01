const phrase = "LINHA DE JOGO";
const copies = [0, 1, 2, 3];

export function LedSign() {
  return (
    <div className="led-board">
      <p className="sr-only">Linha de Jogo</p>
      <div className="led-track" aria-hidden="true">
        {[0, 1].map((group) => (
          <div className="led-group" key={group}>
            {copies.map((copy) => (
              <span className="led-phrase" key={copy}>
                {phrase}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
