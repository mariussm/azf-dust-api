const { test, success, error, warn, noData } = require('../../lib/test')
const { hasData } = require('../../lib/helpers/system-data')
const isPwdLastSet = require('../../lib/helpers/is-pwd-within-timerange')
const licenses = require('./licenses.json')

module.exports = (systemData, user, allData = false) => ([
  test('aad-01', 'Kontoen er aktivert', 'Sjekker at kontoen er aktivert i Azure AD', () => {
    const data = {
      accountEnabled: systemData.accountEnabled
    }
    if (systemData.accountEnabled) return success('Kontoen er aktivert', data)
    return error('Kontoen er deaktivert', data)
  }),
  test('aad-02', 'UPN er lik e-postadressen', 'Sjekker at UPN-et er lik e-postadressen i AD', () => {
    const data = {
      mail: systemData.mail || null,
      userPrincipalName: systemData.userPrincipalName || null
    }
    if (!systemData.userPrincipalName) return error('UPN mangler 🤭', data)
    return systemData.userPrincipalName.toLowerCase() === systemData.mail.toLowerCase() ? success('UPN er lik e-postadressen', data) : error('UPN er ikke lik e-postadressen', data)
  }),
  test('aad-03', 'UPN er korrekt', 'Sjekker at UPN er @vtfk.no for ansatte, og @skole.vtfk.no for elever', () => {
    const data = {
      userPrincipalName: systemData.userPrincipalName || null
    }
    if (!systemData.userPrincipalName) return error('UPN mangler 🤭', data)
    if (user.expectedType === 'employee') return systemData.userPrincipalName.includes('@vtfk.no') ? success('UPN er korrekt', data) : error('UPN er ikke korrekt', data)
    else return systemData.userPrincipalName.includes('@skole.vtfk.no') ? success('UPN er korrekt', data) : error('UPN er ikke korrekt', data)
  }),
  test('aad-04', 'Passord synkronisert til Azure AD', 'Sjekker at passordet er synkronisert til Azure AD innenfor 15 sekunder', () => {
    if (!allData) return noData('Venter på data...')
    if (!hasData(allData.ad)) return error('Mangler AD-data', allData)
    const pwdCheck = isPwdLastSet(new Date(allData.ad.pwdLastSet), new Date(systemData.lastPasswordChangeDateTime))
    const data = {
      aad: {
        lastPasswordChangeDateTime: systemData.lastPasswordChangeDateTime
      },
      ad: {
        pwdLastSet: allData.ad.pwdLastSet
      },
      seconds: pwdCheck.seconds
    }
    if (pwdCheck.result) return success('Passord synkronisert til Azure AD', data)
    else return error('Passord ikke synkronisert', data)
  }),
  test('aad-05', 'Synkroniseres fra lokalt AD', 'Sjekker at synkronisering fra lokalt AD er aktivert', () => {
    const data = {
      onPremisesSyncEnabled: systemData.onPremisesSyncEnabled || null
    }
    if (!hasData(systemData.onPremisesSyncEnabled)) return error('onPremisesSyncEnabled mangler 🤭', data)
    return systemData.onPremisesSyncEnabled ? success('Synkronisering fra lokalt AD er aktivert', data) : warn('Synkronisering fra lokalt AD er ikke aktivert. Dersom brukeren kun eksisterer i Azure AD er dette allikevel riktig', data)
  }),
  test('aad-06', 'Ingen feil i synkroniseringen', 'Sjekker at det ikke er noen feil i synkroniseringen fra lokalt AD', () => {
    const data = {
      onPremisesProvisioningErrors: systemData.onPremisesProvisioningErrors || null
    }
    return hasData(systemData.onPremisesProvisioningErrors) ? error('Synkroniseringsproblemer funnet 🤭', data) : success('Ingen synkroniseringsproblemer funnet', data)
  }),
  test('aad-07', 'Har riktig lisens(er)', 'Sjekker at riktig lisens(er) er aktivert', () => {
    const data = {
      assignedLicenses: systemData.assignedLicenses
    }
    if (!hasData(systemData.assignedLicenses)) return error('Har ingen Azure AD lisenser 🤭', data)
    if (!hasData(user.departmentShort)) return warn('Ikke nok informasjon tilstede for å utføre testen', user)

    const expectedLicenses = licenses.filter(item => item.personType === user.expectedType)[0]
    if (!hasData(expectedLicenses)) return error(`Feilet ved innhenting av lisenstabell for ${user.expectedType} 🤭`, licenses)

    let departmentLicenses
    if (user.expectedType === 'employee') {
      departmentLicenses = expectedLicenses.departments.filter(item => item.department.filter(dep => user.departmentShort.includes(dep)).length > 0)
      if (!hasData(departmentLicenses)) return error(`Feilet ved innhenting av lisenstabell for ${user.expectedType} 🤭`, licenses)
      departmentLicenses = departmentLicenses[0].licenses
    } else {
      departmentLicenses = expectedLicenses.departments[0].licenses
    }

    data.missingLicenses = []
    departmentLicenses.forEach(license => {
      const assigned = systemData.assignedLicenses.filter(assignedLicense => assignedLicense.skuId === license.sku)
      if (!hasData(assigned)) data.missingLicenses.push(license)
    })

    return hasData(data.missingLicenses) ? error(`Mangler ${data.missingLicenses.length} lisens(er)`, data) : success('Lisenser er riktig', data)
  })
])
