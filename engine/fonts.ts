// Geist (OFL, from the motion template). The scene supplies the files in its own assets/fonts (Geist-Regular, -Medium, -SemiBold .woff2). Loaded once, held with delayRender so no frame renders in a fallback face.
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

const FACES: ReadonlyArray<readonly [string, string]> = [["400", "Regular"], ["500", "Medium"], ["600", "SemiBold"]];
export const FONT = "Geist, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const hold = delayRender("Load Geist");
Promise.all(
  FACES.map(([weight, name]) =>
    new FontFace("Geist", `url(${staticFile(`fonts/Geist-${name}.woff2`)})`, { weight }).load().then((f) => document.fonts.add(f)),
  ),
)
  .then(() => continueRender(hold))
  .catch((e) => cancelRender(e));
