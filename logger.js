'use strict';
/* eslint-disable no-console */

const info = console.log;

const error = console.error;

const time = console.time;

const timeEnd = console.timeEnd;

function promise (msg) {
  return function (data) {
    console.log(msg, data);
    return data;
  };
}

module.exports = {
  info,
  error,
  time,
  timeEnd,
  promise
};
