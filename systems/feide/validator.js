const { test, success, warn, error, noData } = require('../../lib/test')
const { SYSTEMS } = require('../../config')
const { hasData } = require('../../lib/helpers/system-data')
const isPwdLastSet = require('../../lib/helpers/is-pwd-within-timerange')
const isValidFnr = require('../../lib/helpers/is-valid-fnr')

module.exports = (systemData, user, allData = false) => ([
  test('feide-01', 'Kontoen er aktivert', 'Sjekker at kontoen er aktivert i FEIDE', () => {
    const data = {
      enabled: systemData.enabled
    }
    if (systemData.enabled) return success('Kontoen er aktivert', data)
    return error('Kontoen er deaktivert', data)
  }),
  test('feide-02', 'Kontoen er ulåst', 'Sjekker at kontoen ikke er sperret for pålogging i FEIDE', () => {
    const data = {
      lockedOut: systemData.lockedOut
    }
    if (!systemData.lockedOut) return success('Kontoen er ikke sperret for pålogging', data)
    return error('Kontoen er sperret for pålogging', data)
  }),
  test('feide-03', 'Har gyldig fødselsnummer', 'Sjekker at fødselsnummer er gyldig', () => {
    const data = {
      norEduPersonNIN: systemData.norEduPersonNIN || null,
      fnr: isValidFnr(systemData.norEduPersonNIN)
    }
    if (!systemData.norEduPersonNIN) return error('Fødselsnummer mangler 🤭', data)
    return data.fnr.valid ? success(`Har gyldig ${data.fnr.type}`, data) : error(data.fnr.error, data)
  }),
  test('feide-04', 'Fødselsnummer er likt i AD', 'Sjekker at fødselsnummeret er likt i AD og FEIDE', () => {
    if (!allData) return noData('Venter på data...')
    if (!hasData(allData.ad)) return error('Mangler AD-data', allData)

    const data = {
      feide: {
        norEduPersonNIN: systemData.norEduPersonNIN
      },
      ad: {
        employeeNumber: allData.ad.employeeNumber
      }
    }
    if (systemData.norEduPersonNIN === allData.ad.employeeNumber) return success('Fødselsnummer er likt i AD og FEIDE', data)
    else return error('Fødselsnummer er forskjellig i AD og FEIDE', data)
  }),
  test('feide-05', 'Passord synkronisert til FEIDE', 'Sjekker at passordet er synkronisert til FEIDE innenfor 15 sekunder', () => {
    if (!allData) return noData('Venter på data...')
    if (!hasData(allData.ad)) return error('Mangler AD-data', allData)
    const pwdCheck = isPwdLastSet(new Date(allData.ad.pwdLastSet), new Date(systemData.passwordLastSet))
    const data = {
      feide: {
        passwordLastSet: systemData.passwordLastSet
      },
      ad: {
        pwdLastSet: allData.ad.pwdLastSet
      },
      seconds: pwdCheck.seconds
    }
    if (pwdCheck.result) return success('Passord synkronisert til FEIDE', data)
    else return error('Passord ikke synkronisert', data)
  }),
  test('feide-06', 'Brukernavn er angitt', 'Sjekker at brukernavnet er angitt', () => {
    const data = {
      name: systemData.name || null
    }
    if (!systemData.name) return error('Brukernavn mangler 🤭', data)
    return success('Brukernavn er angitt', data)
  }),
  test('feide-07', 'Brukernavn er likt i AD', 'Sjekker at brukernavnet er likt i AD og FEIDE', () => {
    if (!allData) return noData('Venter på data...')
    if (!hasData(allData.ad)) return error('Mangler AD-data', allData)

    if (!systemData.name) return error('Brukernavn mangler 🤭', systemData)
    const data = {
      feide: {
        name: systemData.name
      },
      ad: {
        samAccountName: allData.ad.samAccountName
      }
    }
    if (systemData.name === allData.ad.samAccountName) return success('Brukernavn er likt i AD og FEIDE', data)
    else return error('Brukernavn er forskjellig i AD og FEIDE', data)
  }),
  test('feide-08', 'UID er angitt', 'Sjekker at UID er angitt', () => {
    const data = {
      uid: systemData.uid || null
    }
    if (!hasData(systemData.uid)) return error('UID mangler 🤭', data)
    if (systemData.uid.length === 1) return success('UID er angitt', data)
    else if (systemData.uid.length > 1) return error('UID skal bare inneholde ett brukernavn', data)
    else return error('UID er ikke angitt', data)
  }),
  test('feide-09', 'UID er likt brukernavn', 'Sjekker at UID er likt brukernavn', () => {
    const data = {
      uid: systemData.uid || null,
      name: systemData.name || null
    }
    if (!hasData(systemData.uid)) return error('UID mangler 🤭', data)
    if (systemData.uid.length === 1 && systemData.uid[0] === systemData.name) return success('UID er likt brukernavn', data)
    else if (systemData.uid.length > 1) return error('UID skal bare inneholde ett brukernavn', data)
    else return error('UID er ikke angitt', data)
  }),
  test('feide-10', 'PrincipalName er satt', 'Sjekker at PrincipalName er satt', () => {
    const data = {
      eduPersonPrincipalName: systemData.eduPersonPrincipalName || null
    }
    if (!systemData.eduPersonPrincipalName) return error('PrincipalName mangler 🤭', data)
    return success('PrincipalName er satt', data)
  }),
  test('feide-11', `PrincipalName er lik 'uid${SYSTEMS.FEIDE.PRINCIPAL_NAME}'`, `Sjekker at PrincipalName er lik 'uid${SYSTEMS.FEIDE.PRINCIPAL_NAME}'`, () => {
    const data = {
      eduPersonPrincipalName: systemData.eduPersonPrincipalName,
      expectedPersonPrincipalName: `${systemData.name}${SYSTEMS.FEIDE.PRINCIPAL_NAME}`
    }
    return systemData.eduPersonPrincipalName !== `${systemData.name}${SYSTEMS.FEIDE.PRINCIPAL_NAME}` ? error('PrincipalName er feil 🤭', data) : success('PrincipalName er riktig', data)
  }),
  test('feide-12', 'E-postadresse er lik UPN', 'Sjekker at e-postadresse er lik UPN', () => {
    if (!allData) return noData('Venter på data...')
    if (!hasData(allData.ad)) return error('Mangler AD-data', allData)

    const data = {
      feide: {
        mail: systemData.mail
      },
      ad: {
        userPrincipalName: allData.ad.userPrincipalName
      }
    }
    if (systemData.mail === allData.ad.userPrincipalName) return success('E-postadresse er lik UPN', data)
    else return error('E-postadresse er ikke lik UPN', data)
  }),
  test('feide-13', 'Har knyttning til en skole', 'Sjekker at det finnes knyttning til minst èn skole', () => {
    // TODO: Her bør det sjekkes om bruker skal ha tilknyttning til en skole eller ei
    const data = {
      eduPersonOrgUnitDN: systemData.eduPersonOrgUnitDN || null
    }
    if (!hasData(systemData.eduPersonOrgUnitDN)) return error('Knyttning til skole mangler 🤭', data)
    if (systemData.eduPersonOrgUnitDN.length > 0) return success('Knyttning til skole funnet', data)
    else return warn('Ingen knyttning til skole funnet. Dersom dette er en manuelt opprettet FEIDE-bruker eller en administrativ ansatt, er dette korrekt', data)
  }),
  test('feide-14', 'Har satt opp MFA', 'Sjekker at MFA er satt opp', () => {
    const data = {
      norEduPersonAuthnMethod: systemData.norEduPersonAuthnMethod.map(auth => auth.split(' ')[0])
    }
    if (!hasData(systemData.norEduPersonAuthnMethod)) {
      return user.expectedType === 'employee' ? error('MFA er ikke satt opp 🤭', data) : success('MFA er ikke satt opp, og heller ikke påkrevd for elever')
    }
    const smsAuth = systemData.norEduPersonAuthnMethod.filter(auth => auth.includes(SYSTEMS.FEIDE.MFA_SMS))
    const gaAuth = systemData.norEduPersonAuthnMethod.filter(auth => auth.includes(SYSTEMS.FEIDE.MFA_GA))
    if (hasData(smsAuth) && hasData(gaAuth)) return success('MFA for SMS og Godkjenner/Authenticator app er satt opp', data)
    else if (hasData(smsAuth) && !hasData(gaAuth)) return success('MFA for SMS er satt opp', data)
    else if (!hasData(smsAuth) && hasData(gaAuth)) return success('MFA for Godkjenner/Authenticator app er satt opp', data)
    else return warn('MFA for noe annet enn SMS og Godkjenner/Authenticator app er satt opp', data)
  }),
  test('feide-15', 'Organisasjon er riktig', 'Sjekker at organisasjon er riktig', () => {
    const data = {
      eduPersonOrgDN: systemData.eduPersonOrgDN || null,
      expectedOrgDN: SYSTEMS.FEIDE.ORGANIZATION_DN
    }
    if (!hasData(systemData.eduPersonOrgDN)) return error('Organisasjon mangler 🤭', data)
    return systemData.eduPersonOrgDN === SYSTEMS.FEIDE.ORGANIZATION_DN ? success('Organisasjon er riktig', data) : error('Organisasjon er ikke riktig', data)
  }),
  test('feide-16', 'Har riktig tilhørighet', 'Sjekker at det er satt riktig tilhørighet', () => {
    const data = {
      eduPersonAffiliation: systemData.eduPersonAffiliation || null
    }
    if (!hasData(systemData.eduPersonAffiliation)) return error('Tilhørighet mangler 🤭', data)
    if (systemData.eduPersonAffiliation.includes('member') && systemData.eduPersonAffiliation.includes(user.expectedType)) return success('Tilhørighet er riktig', data)
    if (user.expectedType === 'employee') {
      return systemData.eduPersonAffiliation.includes('member') && systemData.eduPersonAffiliation.includes('student') ? warn('Tilhørighet er satt som en elev til tross for at dette er en ansatt', data) : error('Tilhørighet er feil', data)
    } else {
      return systemData.eduPersonAffiliation.includes('member') && systemData.eduPersonAffiliation.includes('employee') ? warn('Tilhørighet er satt som en ansatt til tross for at dette er en elev', data) : error('Tilhørighet er feil', data)
    }
  }),
  test('feide-17', 'Har grupperettigheter', 'Sjekker at det er satt grupperettigheter', () => {
    // TODO: Bør kanskje sjekke at grupperettighetene stemmer overens med data fra PIFU
    const data = {
      eduPersonEntitlement: systemData.eduPersonEntitlement || null
    }
    return !hasData(systemData.eduPersonEntitlement) ? error('Grupperettigheter mangler 🤭', data) : success('Grupperettigheter er riktig', data)
  })
])
