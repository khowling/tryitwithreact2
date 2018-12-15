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
    return new Promise ((acc,rej) => {
        let q_url,
            return_jsonpath = form.source

        if (return_jsonpath === "sobjects") {
            q_url = (query && query._id) ? form.url + `/sobjects/${query._id}/describe` : form.url + "/sobjects"
        } else {
            const flds = "Id," + form.fields.filter(f => query.display === "all" || (query.display === "list" && f.display === "list") || f.display === "primary").map(f => f.name).join(",")
            if (query && query._id) {
                q_url = form.url + `/sobjects/${form.name}/${query._id}?fields=` + encodeURIComponent(flds)
                return_jsonpath = null
            } else {
                q_url = form.url + "/query/?q=" + encodeURIComponent(`SELECT ${flds} FROM ${form.name}`)
            }
        }


        return list_things (context.user.provider.find(p => p.type === "chatter"), q_url).then ((parsedData) => {
            acc (return_jsonpath && parsedData.hasOwnProperty(return_jsonpath) ? parsedData[return_jsonpath] : parsedData)
        }, rej1 => rej(rej1))
    })
}