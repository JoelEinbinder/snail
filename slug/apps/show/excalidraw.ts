export async function renderExcalidraw(filePath: string) {
  const content = await (await fetch(filePath)).json();
  await import('https://unpkg.com/react@16.14.0/umd/react.production.min.js');
  await import ('https://unpkg.com/react-dom@16.13.1/umd/react-dom.production.min.js');
  await import('https://unpkg.com/@excalidraw/excalidraw/dist/excalidraw.production.min.js');

  let er;
  let firstChange = true;
  const App = () => {
    const ref = React.useRef(null);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        "div",
        {
          className: "excalidraw-wrapper",
        },
        React.createElement(ExcalidrawLib.Excalidraw, {
          ref,
          onChange: e => {
            if (!firstChange)
              return;
            firstChange = false;
            ref.current.scrollToContent();
          },
          initialData: content,
          theme: 'dark',
          viewBackgroundColor: '#000000',
          viewModeEnabled: true,
          zenModeEnabled: true,
          gridModeEnabled: false,
          UIOptions: {
            dockedSidebarBreakpoint: 0,
          }
        }),
      ),
    );
  };

  const excalidrawWrapper = document.createElement("div");
  document.body.append(excalidrawWrapper);
  ReactDOM.render(React.createElement(App), excalidrawWrapper);
  console.log(er);
}