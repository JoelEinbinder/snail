FROM node:20
COPY ./electron-out/ /tmp/electron-out
RUN cd /tmp/electron-out/ && npm i --no-package-lock --omit=dev && npx -y electron-packager . --appname=snail --platform=linux --out=built-electron --electron-version=v22.2.0
RUN cd /tmp/electron-out/ && tar czf built-electron.tar.gz -C ./built-electron .
CMD [ "cat", "/tmp/electron-out/built-electron.tar.gz" ]