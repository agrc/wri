#!/bin/bash
npm run --prefix functions check:proxy || exit 1
firebase emulators:start --only functions "$@" 2> >(grep -Ev 'lsof|Output information may be incomplete|assuming "dev=.*" from mount table' >&2)
