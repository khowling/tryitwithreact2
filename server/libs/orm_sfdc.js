const 
    https = require('https')

// ---------------------------------------------- list
const list_things =  (provider, url) => {
    return new Promise ((acc,rej) => {
        console.log (`SFDC list_things: ${url}`)
        let putreq = https.get({ hostname: new URL(provider.instance_url).host, path: url,
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${provider.access_token}`
            }}, (res) => {
                console.log (`list_things status ${res.statusCode}`)

                if(!(res.statusCode === 200 || res.statusCode === 201)) {
                    //console.log (`${res.statusCode} : ${res.statusMessage}`)
                    res.resume();
                    return rej({code: res.statusCode, message: res.statusMessage})
                }

                let rawData = '';
                res.on('data', (chunk) => {
                    //console.log (`list_things got data ${chunk}`)
                    rawData += chunk
                })

                res.on('end', () => {
                    //console.log (`list_things got end ${rawData}`)
                    return acc(JSON.parse(rawData))
                })

                
            }).on('error', (e) =>  rej({code: 'error', message: e}));
    })
}




exports.find = (form, query, context) => {
    return list_things (context.user.provider.find(p => p.type === "chatter"), form.url)
}