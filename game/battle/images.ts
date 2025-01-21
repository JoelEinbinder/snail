import arrows from './gfx/arrows.png'
import bgs from './gfx/bgs.png'
import box from './gfx/box.png'
import cancel from './gfx/cancel.png'
import cancelselected from './gfx/cancelselected.png'
import emptycard from './gfx/emptycard.png'
import enemyhp from './gfx/enemyhp.png'
import hptag from './gfx/hptag.png'
import itemsbg from './gfx/itemsbg.png'
import mainpkm from './gfx/mainpkm.png'
import mainpkmnselected from './gfx/mainpkmnselected.png'
import mini from './gfx/mini.png'
import pickbg from './gfx/pickbg.png'
import pkmncard from './gfx/pkmncard.png'
import pkmncardselected from './gfx/pkmncardselected.png'
import selfhp from './gfx/selfhp.png'
import status from './gfx/status.png'
import trainers from './gfx/trainers.png'
import widgets from './gfx/widgets.png'

export const images = {
  arrows,
  bgs,
  box,
  cancel,
  cancelselected,
  emptycard,
  enemyhp,
  hptag,
  itemsbg,
  mainpkm,
  mainpkmnselected,
  mini,
  pickbg,
  pkmncard,
  pkmncardselected,
  selfhp,
  status,
  trainers,
  widgets,
};
for (const name in images)
  images[name] = new URL(images[name], import.meta.url).href;