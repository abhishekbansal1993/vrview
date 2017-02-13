var EventEmitter = require('eventemitter3');
var IFrameMessageSender = require('./iframe-message-sender');
var Message = require('../message');
var Util = require('../util');

var EMBED_URL = '../../index.html?';
var FAKE_FULLSCREEN_CLASS = 'vrview-fake-fullscreen';

/**
 * Entry point for the VR View JS API.
 *
 * Emits the following events:
 *    ready: When the player is loaded.
 *    modechange: When the viewing mode changes (normal, fullscreen, VR).
 *    click (id): When a hotspot is clicked.
 */
function Player(selector, params) {
  // Create a VR View iframe depending on the parameters.
  var iframe = this.createIframe_(params);
  this.iframe = iframe;

  var parentEl = document.querySelector(selector);
  parentEl.appendChild(iframe);

  // Make a sender as well, for relying commands to the child IFrame.
  this.sender = new IFrameMessageSender(iframe);

  // Listen to messages from the IFrame.
  window.addEventListener('message', this.onMessage_.bind(this), false);

  // Expose a public .isPaused attribute.
  this.isPaused = false;

  if (Util.isIOS()) {
    this.injectFullscreenStylesheet_();
  }
}
Player.prototype = new EventEmitter();

/**
 * @param pitch {Number} The latitude of center, specified in degrees, between
 * -90 and 90, with 0 at the horizon.
 * @param yaw {Number} The longitude of center, specified in degrees, between
 * -180 and 180, with 0 at the image center.
 * @param radius {Number} The radius of the hotspot, specified in meters.
 * @param distance {Number} The distance of the hotspot from camera, specified
 * in meters.
 * @param hotspotId {String} The ID of the hotspot.
 */
Player.prototype.addHotspot = function(hotspotId, params) {
  // TODO: Add validation to params.
  var data = {
    pitch: params.pitch,
    yaw: params.yaw,
    radius: params.radius,
    distance: params.distance,
    id: hotspotId
  };
  this.sender.send({type: Message.ADD_HOTSPOT, data: data});
};

Player.prototype.play = function() {
  this.sender.send({type: Message.PLAY});
};

Player.prototype.pause = function() {
  this.sender.send({type: Message.PAUSE});
};

Player.prototype.setContent = function(contentInfo) {
  var data = {
    contentInfo: contentInfo
  };
  this.sender.send({type: Message.SET_CONTENT, data: data});
};

/**
 * Sets the software volume of the video. 0 is mute, 1 is max.
 */
Player.prototype.setVolume = function(volumeLevel) {
  var data = {
    volumeLevel: volumeLevel
  };
  this.sender.send({type: Message.SET_VOLUME, data: data});
};


/**
 * Helper for creating an iframe.
 *
 * @return {IFrameElement} The iframe.
 */
Player.prototype.createIframe_ = function(params) {
  var iframe = document.createElement('iframe');
  iframe.setAttribute('allowfullscreen', true);
  iframe.setAttribute('scrolling', 'no');
  iframe.style.border = 0;

  // Handle iframe size if width and height are specified.
  if (params.hasOwnProperty('width')) {
    iframe.setAttribute('width', params.width);
    delete params.width;
  }
  if (params.hasOwnProperty('height')) {
    iframe.setAttribute('height', params.height);
    delete params.height;
  }

  var url = EMBED_URL + Util.createGetParams(params);
  iframe.src = url;

  return iframe;
};

Player.prototype.onMessage_ = function(event) {
  var message = event.data;
  var type = message.type.toLowerCase();
  var data = message.data;

  switch (type) {
    case 'ready':
    case 'modechange':
    case 'error':
    case 'click':
      this.emit(type, data);
      break;
    case 'paused':
      console.log('isPaused', data);
      this.isPaused = data;
      break;
    case 'enter-fullscreen':
    case 'enter-vr':
      this.setFakeFullscreen_(true);
      break;
    case 'exit-fullscreen':
      this.setFakeFullscreen_(false);
      break;
    default:
      console.warn('Got unknown message of type %s from %s', message.type, message.origin);
  }
};

/**
 * Note: iOS doesn't support the fullscreen API.
 * In standalone <iframe> mode, VR View emulates fullscreen by redirecting to
 * another page.
 * In JS API mode, we stretch the iframe to cover the extent of the page using
 * CSS. To do this cleanly, we also inject a stylesheet.
 */
Player.prototype.setFakeFullscreen_ = function(isFullscreen) {
  if (isFullscreen) {
    this.iframe.classList.add(FAKE_FULLSCREEN_CLASS);
  } else {
    this.iframe.classList.remove(FAKE_FULLSCREEN_CLASS);
  }
};

Player.prototype.injectFullscreenStylesheet_ = function() {
  var styleString = [
    'iframe.' + FAKE_FULLSCREEN_CLASS,
    '{',
      'position: fixed !important;',
      'display: block !important;',
      'z-index: 9999999999 !important;',
      'top: 0 !important;',
      'left: 0 !important;',
      'width: 100% !important;',
      'height: 100% !important;',
      'margin: 0 !important;',
    '}',
  ].join('\n');
  var style = document.createElement('style');
  style.innerHTML = styleString;
  document.body.appendChild(style);
};


module.exports = Player;
