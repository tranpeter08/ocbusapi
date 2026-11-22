import https from 'node:https';

export function fetchOctaBuffer(url: string): Promise<Buffer> {
  return new Promise(function (resolve, reject) {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Accept: '*/*',
            'Accept-Encoding': 'identity',
          },
          rejectUnauthorized: false,
        },
        function (res) {
          const status = res.statusCode || 0;
          if (status === 301 || status === 302) {
            if (res.headers.location) {
              return resolve(fetchOctaBuffer(res.headers.location));
            }
          }

          if (status !== 200) {
            return reject(new Error(`OCTA HTTP status: ${status}`));
          }

          const chunks: Buffer[] = [];
          res.on('data', function (chunk) {
            chunks.push(chunk);
          });
          res.on('end', function () {
            resolve(Buffer.concat(chunks));
          });
          res.on('error', reject);
        }
      )
      .on('error', reject);
  });
}
