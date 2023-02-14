#!/usr/bin/env sh
set -e
echoerr() { echo "$@" 1>&2; }
get_node_url_for_platform() {
  PLATFORM=$(uname -s)
  ARCH=$(uname -m)
  if [ $PLATFORM = Darwin ]
  then
    if [ $ARCH = arm64 ]
    then
      echo "https://nodejs.org/dist/v18.14.0/node-v18.14.0-darwin-arm64.tar.gz"
    else
      echoerr Unknown arch: $ARCH
      exit 1
    fi
  elif [ $PLATFORM = Linux ]
  then
    if [ $ARCH = aarch64 ]
    then
      echo "https://nodejs.org/dist/v18.14.0/node-v18.14.0-linux-arm64.tar.gz"
    elif [ $ARCH = x86_64 ]
    then
      echo "https://nodejs.org/dist/v18.14.0/node-v18.14.0-linux-x64.tar.gz"
    else
      echoerr Unknown arch: $ARCH
      exit 1
    fi
  else
    echoerr Unknown platform: $PLATFORM
    exit 1
  fi
}
download_url() {
  if [ -x "$(which wget)" ]
  then
    wget --quiet -O $1 $2
  else
    if [ -x "$(which curl)" ]
    then
      curl --no-progress-meter -o $1 $2
    else
      echoerr no curl or wget found to do download
      exit 1
    fi
  fi
}
SNAIL_PATH=".snail"
if [ ! -d $SNAIL_PATH/$SNAIL_VERSION ]
then
  echoerr Downloading snail runtime...
  mkdir -p $SNAIL_PATH
  SNAIL_TGZ=slug-$SNAIL_VERSION-$(uname -s)-$(uname -m).tar.gz
  download_url $SNAIL_PATH/$SNAIL_TGZ $SNAIL_SLUGS_URL/$SNAIL_TGZ
  mkdir -p $SNAIL_PATH/$SNAIL_VERSION
  tar xf $SNAIL_PATH/$SNAIL_TGZ -C $SNAIL_PATH/$SNAIL_VERSION
  rm $SNAIL_PATH/$SNAIL_TGZ
fi
cd .snail/$SNAIL_VERSION
if [ ! -f ./node/bin/node ]
then
  echoerr Downloading node for $(uname -s) $(uname -m)...
  download_url node.tar.gz $(get_node_url_for_platform)
  mkdir node
  tar xf node.tar.gz -C node --strip-components 1
  rm node.tar.gz
fi
if [ ! -d ./node_modules ]
then
  echoerr Running npm install for the snail runtime...
  PATH=$(pwd)/node/bin:$PATH ./node/bin/npm install --silent --no-package-lock --omit=dev
fi
cd ../../
.snail/$SNAIL_VERSION/node/bin/node .snail/$SNAIL_VERSION/shell/wsPipeWrapper.js

