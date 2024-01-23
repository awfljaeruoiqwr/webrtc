const MOTOR_CONTROLLER_MACHINE_ID = 183;
const USER_MACHINE_ID = 184;
const ID = 1;
const PID_PNT_VEL_CMD = 207;
const PID_PNT_MAIN_TOTAL_DATA_NUM = 24;
const PID_MAIN_DATA = 193;
const ENABLE = 1;
const RETURN_PNT_MAIN_DATA = 2;
const MAX_PACKET_SIZE = 255;

const LEFT = 0;
const RIGHT = 1;
const VELOCITY_CONSTANT_VALUE = 9.5492743;

function byte2int(lowByte, highByte) {
    return (highByte << 8) | lowByte;
}
  
function byte2long(data1, data2, data3, data4) {
    return ((data4 << 24) | (data3 << 16) | (data2 << 8) | data1) >>> 0; // unsigned right shift 사용
}
  
function int2byte(nIn) {
    let buffer = Buffer.alloc(2); // 2바이트 버퍼 생성
    buffer.writeInt16LE(nIn, 0); // Little-endian으로 정수를 버퍼에 쓴다.
    return {
      byLow: buffer[0],
      byHigh: buffer[1]
    };
}

const SerialPort = require('serialport');
function initializeSerialPort(portName) {
    const port = new SerialPort(portName, {
      baudRate: 19200,
      parity: 'none',
      stopBits: 1,
      dataBits: 8
    });

    port.on('data', function(data) {
        console.log('Data:', data.toString());
    });

    port.on('error', function(err) {
        console.error('Error:', err.message);
    });

    return port;
}

let goal_rpm_speed = new Int16Array(2);

function robotSpeedToRPMSpeed(linear, angular) {
    let wheel_velocity_cmd = [0, 0];

    const wheel_radius = 0.085;
    const wheel_separation = 0.68;
    const reduction = 1;
    const nMaxRPM = 200;
    const VELOCITY_CONSTANT_VALUE = 9.5492743;

    wheel_velocity_cmd[0] = linear + (angular * wheel_separation / 2); // LEFT
    wheel_velocity_cmd[1] = linear - (angular * wheel_separation / 2); // RIGHT

    wheel_velocity_cmd[0] = Math.min(Math.max(wheel_velocity_cmd[0] * VELOCITY_CONSTANT_VALUE / wheel_radius * reduction, -nMaxRPM), nMaxRPM);
    wheel_velocity_cmd[1] = Math.min(Math.max(wheel_velocity_cmd[1] * VELOCITY_CONSTANT_VALUE / wheel_radius * reduction, -nMaxRPM), nMaxRPM);

    goal_rpm_speed[0] = Math.round(wheel_velocity_cmd[0]);
    goal_rpm_speed[1] = Math.round(wheel_velocity_cmd[1]);
}

function putPNTVelCmd(port, nLeftRPM, nRightRPM) {
    let byD = Buffer.alloc(MAX_PACKET_SIZE); // MAX_PACKET_SIZE 만큼의 버퍼를 할당합니다.
    let byChkSum = 0;
    let byDataNum = 7;
  
    byD[0] = MOTOR_CONTROLLER_MACHINE_ID;
    byD[1] = USER_MACHINE_ID;
    byD[2] = ID;
    byD[3] = PID_PNT_VEL_CMD;
    byD[4] = byDataNum;
    byD[5] = ENABLE;
    let iData = int2byte(nLeftRPM);
    byD[6] = iData.byLow;
    byD[7] = iData.byHigh;
    byD[8] = ENABLE;
    iData = int2byte(nRightRPM);
    byD[9] = iData.byLow;
    byD[10] = iData.byHigh;
    byD[11] = RETURN_PNT_MAIN_DATA;
  
    for (let i = 0; i < 12; i++) {
      byChkSum += byD[i];
    }
    byD[12] = (~byChkSum + 1) & 0xFF;
  
    // SendData 함수에 해당하는 코드, 시리얼 포트를 통해 데이터를 전송
    port.write(byD.slice(0, 13), function(err) { 
      if (err) {
        return console.log('Error on write: ', err.message);
      }
      console.log('message written');
    });
  
    return 1;
  }

module.exports = {
    initializeSerialPort, robotSpeedToRPMSpeed, putPNTVelCmd, goal_rpm_speed
};
