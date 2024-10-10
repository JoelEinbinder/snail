from matplotlib.backend_bases import (
     FigureCanvasBase, FigureManagerBase)
from matplotlib.backends import backend_svg
import matplotlib.pyplot as plt
plt.ion()

class FigureManagerTemplate(FigureManagerBase):
  def show(self) -> None:
    global my_canvas
    my_canvas = self.canvas
    self.canvas.draw()

shown = False

def newCommandStarted():
   global shown
   shown = False


messagesToSend = []

def commandFinished():
    for message in messagesToSend:
       message()
    messagesToSend.clear()

class FigureCanvasTemplate(FigureCanvasBase):
  manager_class = FigureManagerTemplate

  def draw(self):
    global shown
    import json
    import io

    def send(data, dont_cache=False):
      str = json.dumps(data)
      print('\x1b\x1a' + ('Q' if dont_cache else 'M') + str + '\x00', end='', flush=True)

    if not shown:
        import os
        def display(filePath):
            print('\x1b\x1aL' + str(filePath) + '\x00', end='', flush=True)
        dirname = os.path.dirname(__file__)
        display(os.path.join(dirname, 'web.ts'))
        shown = True
    
    def draw_later():
        stream = io.StringIO()        
        renderer = backend_svg.RendererSVG(float(self.figure.bbox.width), float(self.figure.bbox.height), stream)
        self.figure.draw(renderer)
        renderer.finalize()
        send({
           "svg": stream.getvalue(),
           "id": self.figure.number,
        })
    messagesToSend.append(draw_later)


FigureCanvas = FigureCanvasTemplate
FigureManager = FigureManagerTemplate
