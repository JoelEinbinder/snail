FROM node:20-buster
COPY ./slug-out/ /tmp/slug-out
RUN cd /tmp/slug-out/ && npm i --no-package-lock --omit=dev
RUN cd /tmp/ && tar czf slug.tar.gz -C ./slug-out .
CMD [ "cat", "/tmp/slug.tar.gz" ]