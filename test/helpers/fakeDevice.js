const { randomUUID } = require('crypto')

class FakeDevice {

  constructor () {
    const identifier = randomUUID()

    this.host = {
      address: identifier,
      macAddress: identifier
    };

    this.callbacks = {};

    this.isUnitTestDevice = true;

    this.resetSentHexCodes();
  }

  resetSentHexCodes () {
    this.sentHexCodes = []
  }

  getSentHexCodeCount () {
    return this.sentHexCodes.length
  }

  hasSentCode (hexCode) {
    return (this.sentHexCodes.indexOf(hexCode) > -1);
  }

  hasSentCodes (hexCodes) {
    let hasSentCodes = true
    
    hexCodes.forEach((hexCode) => {
      if (this.sentHexCodes.indexOf(hexCode) === -1) {hasSentCodes = false}
    })
  
    return hasSentCodes
  }

  sendData (hexBufferData, debug, originalHexString) {
    if (!hexBufferData) {throw new Error('Missing HEX Data')}

    this.sentHexCodes.push(originalHexString)
  }

  on (type, callback) {
    this.callbacks[type] = callback;
  }

  sendFakeOnCallback (type, value) {
    const callback = this.callbacks[type];

    if(callback) {callback(value);}
  }

  checkTemperature () {
    
  }
}

module.exports = FakeDevice