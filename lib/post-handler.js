'use strict';
const crypto = require('crypto');
const pug = require('pug');
const moment = require('moment-timezone');
const Cookies = require('cookies');
const util = require('./handler-util');
const Post = require('./post');

const trackingIdKey = 'tracking_id';

const oneTimeTokenMap = new Map(); // キーをユーザー名、値をトークンとする連想配列

function handle(req, res) {
  const cookies = Cookies(req, res);
  const trackingId = addTrackingCookies(cookies, req.user);

  switch(req.method) {
    case 'GET':
      res.writeHead(200, {
        'Content-type': 'text/html; charset=utf-8'
      });
      Post.findAll({order: [['id', 'DESC']]}).then((posts) => {
        posts.forEach((post) => {
          post.formattedCreatedAt = moment(post.createdAt).tz('Asia/Tokyo').format('YYYY年MM月DD日 HH時mm分ss秒');
          post.content = post.content.replace(/\+/g, ' ');
        });
        const oneTimeToken = crypto.randomBytes(8).toString('hex');
        oneTimeTokenMap.set(req.user, oneTimeToken);
        res.end(pug.renderFile('./views/posts.pug', {
          posts: posts,
          user: req.user,
          oneTimeToken: oneTimeToken
        }));
      });
      console.info(
        `閲覧されました: user: ${req.user}, ` + 
        `trackingID: ${trackingId}, ` + 
        `remoteAddress: ${req.connection.remoteAddress}, ` +
        `userAgent: ${req.headers['user-agent']}`
      );
      break;
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', () => {
        const decoded = decodeURIComponent(body);
        const dataArray = decoded.split('&');
        const content = dataArray[0] ? dataArray[0].split('content=')[1]: '';
        const requestedoneTimeToken = dataArray[1] ? dataArray[1].split('oneTimeToken=')[1]: '';
        if (oneTimeTokenMap.get(req.user) === requestedoneTimeToken) {
          Post.create({
            content: content,
            trackingCookie: trackingId,
            postedBy: req.user
          }).then(() => {
            oneTimeTokenMap.delete(req.user);
            handleRedirectPosts(req, res);
          });
        } else {
          util.handleBadRequest(req, res);
        }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

function handleDelete(req, res) {
  switch(req.method) {
    case 'POST':
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      }).on('end', () => {
        const decoded = decodeURIComponent(body);
        const dataArray = decoded.split('&');
        const id = dataArray[0] ? dataArray[0].split('id=')[1]: '';
        const requestedoneTimeToken = dataArray[1] ? dataArray[1].split('oneTimeToken=')[1]: '';
        console.log(requestedoneTimeToken);
        if (oneTimeTokenMap.get(req.user) === requestedoneTimeToken) {
          Post.findById(id).then((post) => {
            if (req.user === post.postedBy || req.user === 'admin') {
              post.destroy().then(() => {
                console.info(
                  `削除されました: user: ${req.user}, ` +
                  `remoteAddress: ${req.connection.remoteAddress}, ` +
                  `userAgent: ${req.headers['user-agent']} `
                );
                oneTimeTokenMap.delete(req.user);
                handleRedirectPosts(req, res);
              });
            }
          });
        } else {
          util.handleBadRequest(req, res);
        }
      });
      break;
    default:
      util.handleBadRequest(req, res);
      break;
  }
}

/**
 * Cookieに含まれているトラッキングIDに異常がなければその値を返し、
 * 存在しない場合や異常なものである場合には、再度作成しCookieに付与してその値を返す
 * @param {Cookies} cookies
 * @param {String} userName
 * @return {String} トラッキングID
 */
function addTrackingCookies(cookies, userName) {
  const requestedtrackingId = cookies.get(trackingIdKey);
  if (isValidTrackingId(requestedtrackingId, userName)) {
    return requestedtrackingId;
  } else {
    const originalId = parseInt(crypto.randomBytes(8).toString('hex'), 16);
    const trackingId = `${originalId}_${createValidHash(originalId, userName)}`;
    const tomorrow = new Date(Date.now() + (1000 * 60 * 60 * 24));
    cookies.set(trackingIdKey, trackingId, {expires: tomorrow});
    return trackingId;
  }
}

function isValidTrackingId(trackingId, userName) {
  if (!trackingId) {
    return false;
  }
  const splitted = trackingId.split('_');
  const originalId = splitted[0];
  const requestedHash = splitted[1];
  return createValidHash(originalId, userName) === requestedHash;
}

const secretKey =
  `f858649e7785c665f01b67e72e020aea7a4fe28a076326dc236390a90835d0bd2750b69fda901405b352e9ad52f00ab46db7233e8ab9fd96a18fe
  8a9657d30ed7d4fc1e4df45b19e4999688c3b4552b5cd6f7f10b5bab9b73aaf00a3e01ccc73806281f9c18a2f2e4877c20b0e329d423470591803c
  19d098ed46997df0e1c940b307907c3f1d464485b34bb345c9897b71bd06db1685173526867a77f95c108037769ca6a57df9d88b01a3e09ba6e3dc
  3cd8477c2bac90fc663fa80dd297fd4d9251786d5f71197f477b3daacb70935a5a25be75bfaad7eccdbfcd6a93ace53bab5d4b04e8a4d5c5185366
  a7281405114802abf1c2444bfcffd30508c8209ce`;

function createValidHash(originalId, userName) {
  const sha1sum = crypto.createHash('sha1');
  sha1sum.update(originalId + userName + secretKey);
  return sha1sum.digest('hex');
}

function handleRedirectPosts(req, res) {
  res.writeHead(303, {
    'Location': '/posts'
  });
  res.end();
}

module.exports = {
  handle,
  handleDelete
};