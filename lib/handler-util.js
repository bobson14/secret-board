'use strict';

function handleLogout(req, res) {
  res.writeHead(401, {
    'Content-type': 'text/plain; charset=utf-8'
  });
  res.end('ログアウトしました');
}

function handleNotFound(req, res) {
  res.writeHead(404, {
    'Content-type': 'text/plain; charset=utf-8'
  });
  res.end('ページが見つかりませんでした');
}

function handleBadRequest(req, res) {
  res.writeHead(400, {
    'Content-type': 'text/plain; charset=utf-8'
  });
  res.end('未対応のメソッドです');
}

module.exports = {
  handleLogout,
  handleNotFound,
  handleBadRequest
};