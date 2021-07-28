const { test, success, error, warn, noData } = require('../../lib/test')
const { SYSTEMS } = require('../../config')
const { hasData } = require('../../lib/helpers/system-data')
const isValidFnr = require('../../lib/helpers/is-valid-fnr')
const getActiveSourceData = require('../../lib/helpers/get-active-source-data')

const hasCorrectCompany = company => /(\w.+ [vV]id.+ [sS]k.+)|([Ff]agskolen [Vv]estfold og [Tt]elemark)|([Kk]ompetansebyggeren)/.test(company)

let dataPresent = true

module.exports = (systemData, user, allData = false) => ([
  test('ad-01', 'Har data', 'Sjekker at det finnes data her', () => {
    dataPresent = hasData(systemData)
    return dataPresent ? success('Har data') : error('Mangler data 😬')
  }),
  test('ad-02', 'Kontoen er aktivert', 'Sjekker at kontoen er aktivert i AD', () => {
    if (!dataPresent) return noData()
    const data = {
      enabled: systemData.enabled
    }

    if (user.expectedType === 'employee') {
      if (allData.visma) {
        data.visma = getActiveSourceData(allData.visma, user)
        if (systemData.enabled && data.visma.active) return success('Kontoen er aktivert', data)
        else if (systemData.enabled && !data.visma.active) return error('Kontoen er aktivert selvom ansatt har sluttet', data)
        else if (!systemData.enabled && data.visma.active) return warn('Kontoen er deaktivert. Ansatt må aktivere sin konto', data)
        else if (!systemData.enabled && !data.visma.active) return warn('Kontoen er deaktivert', data)
      }
    } else {
      if (allData.pifu) {
        data.pifu = getActiveSourceData(allData.pifu, user)
        if (systemData.enabled && data.pifu.active) return success('Kontoen er aktivert', data)
        else if (systemData.enabled && !data.pifu.active) return error('Kontoen er aktivert selvom elev har sluttet', data)
        else if (!systemData.enabled && data.pifu.active) return warn('Kontoen er deaktivert. Eleven må aktivere sin konto', data)
        else if (!systemData.enabled && !data.pifu.active) return warn('Kontoen er deaktivert', data)
      }
    }

    if (!allData.visma && !allData.pifu) return systemData.enabled ? success('Kontoen er aktivert', data) : error('Kontoen er deaktivert', data)
  }),
  test('ad-03', 'Kontoen er ulåst', 'Sjekker at kontoen ikke er sperret for pålogging i AD', () => {
    if (!dataPresent) return noData()
    const data = {
      lockedOut: systemData.lockedOut
    }
    if (!systemData.lockedOut) return success('Kontoen er ikke sperret for pålogging', data)
    return error('Kontoen er sperret for pålogging', data)
  }),
  test('ad-04', 'Brukernavn følger riktig algoritme', 'Sjekker at brukernavnet stemmer med fornavn og fødselsdato', () => {
    if (!dataPresent) return noData()
    if (!systemData.samAccountName) return error('Brukernavn mangler 🤭', systemData)

    const samName = systemData.samAccountName.substring(0, 3).toLowerCase()
    const firstName = systemData.givenName.toLowerCase().replace('å', 'aa').replace('ø', 'o').replace('æ', 'e').substring(0, 3)
    const samDate = systemData.samAccountName.substring(3, 7)
    const employeeDate = systemData.employeeNumber.substring(0, 4)
    return samName === firstName && samDate === employeeDate ? success('Brukernavn samsvarer med navn', { samAccountName: systemData.samAccountName }) : error('Brukernavn samsvarer ikke med navn', { samAccountName: systemData.samAccountName, firstName: systemData.givenName, employeeNumber: systemData.employeeNumber })
  }),
  test('ad-05', 'UPN er lik e-postadressen', 'Sjekker at UPN-et er lik e-postadressen i AD', () => {
    if (!dataPresent) return noData()
    if (!systemData.userPrincipalName) return error('UPN mangler 🤭', systemData)
    const data = {
      mail: systemData.mail,
      userPrincipalName: systemData.userPrincipalName
    }
    return systemData.userPrincipalName.toLowerCase() === systemData.mail.toLowerCase() ? success('UPN er lik e-postadressen', data) : error('UPN er ikke lik e-postadressen', data)
  }),
  test('ad-06', 'UPN er korrekt', 'Sjekker at UPN er @vtfk.no for ansatte, og @skole.vtfk.no for elever', () => {
    if (!dataPresent) return noData()
    if (!systemData.userPrincipalName) return error('UPN mangler 🤭', systemData)
    const data = {
      userPrincipalName: systemData.userPrincipalName
    }
    if (user.expectedType === 'employee') return systemData.userPrincipalName.includes('@vtfk.no') ? success('UPN er korrekt', data) : error('UPN er ikke korrekt', data)
    else return systemData.userPrincipalName.includes('@skole.vtfk.no') ? success('UPN er korrekt', data) : error('UPN er ikke korrekt', data)
  }),
  test('ad-07', 'OU er korrekt', 'Sjekker at bruker ligger i riktig OU', () => {
    if (!dataPresent) return noData()
    const data = {
      distinguishedName: systemData.distinguishedName,
      ou: {
        expected: '',
        current: systemData.distinguishedName.slice(systemData.distinguishedName.indexOf(',') + 1)
      },
      enabled: systemData.enabled
    }

    if (user.expectedType === 'employee') {
      if (allData.visma) data.visma = getActiveSourceData(allData.visma, user)
      if (systemData.enabled) {
        if (data.visma && data.visma.active) {
          data.ou.expected = SYSTEMS.AD.EMPLOYEE_ENABLED_OU
          if (systemData.distinguishedName.includes(SYSTEMS.AD.EMPLOYEE_ENABLED_OU)) return success('OU er korrekt', data)
          else return error('OU er ikke korrekt', data)
        } else {
          data.ou.expected = SYSTEMS.AD.EMPLOYEE_DISABLED_OU
          if (systemData.distinguishedName.includes(SYSTEMS.AD.EMPLOYEE_ENABLED_OU)) return error('OU er ikke korrekt', data)
          else return success('OU er korrekt', data)
        }
      }
      else {
        if (data.visma && data.visma.active) {
          data.ou.expected = SYSTEMS.AD.EMPLOYEE_ENABLED_OU
          if (systemData.distinguishedName.includes(SYSTEMS.AD.EMPLOYEE_ENABLED_OU)) return success('OU er korrekt', data)
          else return error('OU er ikke korrekt', data)
        } else {
          data.ou.expected = SYSTEMS.AD.EMPLOYEE_DISABLED_OU
          if (systemData.distinguishedName.includes(SYSTEMS.AD.EMPLOYEE_DISABLED_OU)) return success('OU er korrekt', data)
          else return error('OU er ikke korrekt', data)
        }
      }
    } else {
      if (allData.pifu) data.pifu = getActiveSourceData(allData.pifu, user)
      if (systemData.enabled) return systemData.distinguishedName.includes(SYSTEMS.AD.STUDENT_ENABLED_OU) ? success('OU er korrekt', data) : error('OU er ikke korrekt', data)
      else return systemData.distinguishedName.includes(SYSTEMS.AD.STUDENT_DISABLED_OU) ? success('OU er korrekt', data) : error('OU er ikke korrekt', data)
    }
  }),
  test('ad-08', 'Har gyldig fødselsnummer', 'Sjekker at fødselsnummer er gyldig', () => {
    if (!dataPresent) return noData()
    if (!systemData.employeeNumber) return error('Fødselsnummer mangler 🤭', systemData)
    const data = {
      employeeNumber: systemData.employeeNumber,
      fnr: isValidFnr(systemData.employeeNumber)
    }
    return data.fnr.valid ? success(`Har gyldig ${data.fnr.type}`, data) : error(data.fnr.error, data)
  }),
  test('ad-09', 'extensionAttribute6 er satt', 'Sjekker at extensionAttribute6 er satt', () => {
    if (!dataPresent) return noData()
    const data = {
      extensionAttribute6: systemData.extensionAttribute6
    }
    if (user.expectedType === 'employee') return hasData(systemData.extensionAttribute6) ? success('extensionAttribute6 er satt', data) : error('extensionAttribute6 mangler 🤭', data)
    else return hasData(systemData.extensionAttribute6) ? warn('extensionAttribute6 er satt på en elev. Elever trenger ikke denne', data) : success('extensionAttribute6 er ikke satt, men siden dette er en elev er det helt normalt', systemData)
  }),
  test('ad-10', 'Har kun èn primær e-postadresse', 'Sjekker at brukeren har kun èn primær e-postadresse', () => {
    if (!dataPresent) return noData()
    const data = {
      proxyAddresses: systemData.proxyAddresses,
      primary: systemData.proxyAddresses.filter(address => address.startsWith('SMTP:'))
    }
    if (user.expectedType === 'employee') {
      if (data.primary.length === 1) return success('Har kun 1 primær e-postadresse', data)
      else return error(`Har ${data.primary.length} primær e-postadresser`, data)
    } else {
      if (data.primary.length === 0) return success('Har ingen primær e-postadresse, men siden dette er en elev er dette korrekt. Mail-attributtet vil være gjeldende', { ...data, mail: systemData.mail })
      else if (data.primary.length === 1) return success('Har 1 primær e-postadresse, dette er også korrekt for en elev', data)
      else return error(`Har ${data.primary.length} primær e-postadresser`, data)
    }
  }),
  test('ad-11', 'Har state satt for ansatt', 'Sjekker at state er satt på ansatt', () => {
    if (!dataPresent) return noData()
    if (user.expectedType === 'student') return noData()
    if (user.expectedType === 'employee') {
      if (hasData(systemData.state)) return success('Felt for lisens er fylt ut', { state: systemData.state })
      else return error('Felt for lisens mangler 🤭', systemData)
    }
  }),
  test('ad-12', 'Navn har ropebokstaver', 'Sjekker om navnet er skrevet med ropebokstaver', () => {
    if (!dataPresent) return noData()

    const data = {
      displayName: systemData.displayName,
      givenName: systemData.givenName,
      surName: systemData.sn
    }
    return systemData.displayName === systemData.displayName.toUpperCase() ? warn('Navn er skrevet med ropebokstaver', data) : noData()
  }),
  test('ad-13', 'Fornavn har punktum', 'Sjekker om fornavn har punktum', () => {
    if (!dataPresent) return noData()

    const data = {
      displayName: systemData.displayName,
      givenName: systemData.givenName,
      surName: systemData.sn
    }
    return systemData.givenName.includes('.') ? warn('Navn har punktum', data) : noData()
  }),
  test('ad-14', 'Riktig company', 'Sjekker at bruker har rett company-info', () => {
    if (!dataPresent) return noData()

    const data = {
      company: user.company
    }

    if (user.expectedType === 'student') {
      if (user.company) return hasCorrectCompany(user.company) ? success('Bruker har riktig company', data) : error('Bruker har ikke skolenavn i company-feltet', data)
      else return error('Bruker mangler info i company-feltet', data)
    } else return noData()
  })
])
