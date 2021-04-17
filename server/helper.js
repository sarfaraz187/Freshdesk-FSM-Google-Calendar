const base64 = require('base-64');
async function calendarApi(options) {
  var opt = {
    headers: {
      "Authorization": "Bearer <%= access_token %>",
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    isOAuth: true
  };
  let base_url = `https://www.googleapis.com/calendar/v3/${options.type}`;
  console.log({ base_url });
  if('body' in options) {
    opt['body'] = options.body
  } 
  var [error, result] = await responseHandler($request[options.method](base_url, opt));
  if (error) {
    console.log(error.response.data)
  } else {
    return result
  }
}

async function requestApi(options) {
  console.log(options);
  var opt = {
    headers: {
      "Authorization": "Basic " + base64.encode(options.iparams.apiKey + ":x"),
      "Content-Type": "application/json; charset=utf-8"
    }
  };
  let url = (options.iparams.domain.startsWith('https://')) ? `${options.iparams.domain}/` + options.url : `https://${options.iparams.domain}/` + options.url;
  console.log({ url });
  let request = ('body' in options) ? $request[options.method](url, options.body, opt) : $request[options.method](url, opt)
  var [error, result] = await responseHandler(request)
  if (error) {
    console.log(error.response.data.errors);
  } else {
    return result.response
  }
}

function responseHandler(promise, improved) {
  return promise.then((data) => [null, data], (err) => {
    if (improved) {
      Object.assign(err, improved);
    }
    return [err];
  });
}

exports = {
  calendarApi : calendarApi,
  requestApi : requestApi
};