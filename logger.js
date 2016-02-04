'use strict';
/* eslint-disable no-console */

const info = console.log;

const time = console.time;

const timeEnd = console.timeEnd;

function promise(msg) {
  return function(data) {
    console.log(msg, data);
    return data;
  };
}

module.exports = {
  info,
  time,
  timeEnd,
  promise
};
