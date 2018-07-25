/**
 *  Node Proxy (STNP)
 *
 *  Original Author: redloro@gmail.com
 *  Modified By: andyvt@babgvant.com
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 */

////////////////////
// DO NOT CHANGE BELOW THIS LINE
////////////////////
var express = require('express');
var http = require('http');
var app = express();
var nconf = require('nconf');
nconf.file({ file: './config.json' });
var logger = function(str) {
  mod = 'stnp';
  if(typeof str != "string"){
    str = JSON.stringify(str);
  }
  console.log("[%s] [%s] %s", new Date().toISOString(), mod, str);
}

/**
 * Root route
 */
app.get('/', function (req, res) {
  res.status(200).json({ status: 'Node Proxy running' });
});

/**
 * Enforce basic authentication route; verify that HTTP.HEADERS['stnp-auth'] == CONFIG['authCode']
 */
app.use(function (req, res, next) {
  logger(req.ip+' '+req.method+' '+req.url);

  if(nconf.get('requireAuth')){
    var headers = req.headers;
    if (!headers['stnp-auth'] ||
      headers['stnp-auth'] != nconf.get('authCode')) {
      logger('Authentication error');
      res.status(500).json({ error: 'Authentication error' });
      return;
    }
  }
  next();
});

/**
 * Subscribe route used by SmartThings Hub to register for callback/notifications and write to config.json
 * @param {String} host - The SmartThings Hub IP address and port number
 */
// app.get('/subscribe/:host', function (req, res) {
//   var parts = req.params.host.split(":");
//   nconf.set('notify:address', parts[0]);
//   nconf.set('notify:port', parts[1]);
//   nconf.save(function (err) {
//     if (err) {
//       logger('Configuration error: '+err.message);
//       res.status(500).json({ error: 'Configuration error: '+err.message });
//       return;
//     }
//   });
//   res.end();
// });

/**
 * Startup
 */
var server = app.listen(nconf.get('port') || 8080, function () {
  logger('Node Proxy listening at http://'+server.address().address+':'+server.address().port);
});

/**
 * Load all plugins
 */
var fs = require('fs');
fs.readdir('./plugins', function(err, files) {
  if (!err) {
    files
    .filter(function(file) { return file.substr(-3) === '.js'; })
    .forEach(function(file) {
      var plugin = file.split(".")[0];
      app.use('/plugins/'+plugin, require('./plugins/'+plugin)(function(data){notify(plugin,data);}));
      logger('Loaded plugin: '+plugin);
    });
  } else {
    logger(err);
  }
});

/**
 * Callback to the HTTP server (e.g. Vera)
 * @param {String} plugin - The name of the STNP plugin
 * @param {String} data - The HTTP message body
 */
var notify = function(plugin, data) {
  if (!nconf.get('statusConfig:baseUrl') || nconf.get('statusConfig:baseUrl').length == 0 ) {
    logger("Notify server address and port not set!");
    return;
  }
// console.log(plugin);
// console.log(data);
  if(data.update){
    let state = nconf.get(`statusConfig:${data.update.type}:${data.state}`);
    if(state && state != ''){
      let url = `${nconf.get('statusConfig:baseUrl')}${data.update.deviceId}${state}`;
      logger(url);
      http.get(url, (resp) => {
        let data = '';

        resp.on('data', (chunk) => {
          data += chunk;
        });

        resp.on('end', () => {
          logger(data);
        });

      }).on("error", (err) => {
        logger("Error: " + err.message);
      });
    }
  }
}
