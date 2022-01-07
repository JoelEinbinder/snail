#!/usr/bin/env bash
while IFS= read -u 1 -r line
do
    eval "$line"
    echo "$1"
done
