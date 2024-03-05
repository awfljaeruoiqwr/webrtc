import asyncio, aiohttp
import json
import serial
import struct
import requests
import time
import numpy as np
import ssl

MOTOR_CONTROLLER_MACHINE_ID = 183
USER_MACHINE_ID             = 184
ID                          = 1
PID_PNT_VEL_CMD             = 207
PID_PNT_MAIN_TOTALD_ATA_NUM = 24
PID_MAIN_DATA               = 193
ENABLE                      = 1  
RETURN_PNT_MAIN_DATA        = 2
MAX_PACKET_SIZE             = 255

LEFT                        = 0
RIGHT                       = 1
VELOCITY_CONSTANT_VALUE     = 9.5492743

def byte2int(low_byte, high_byte):
    return low_byte | high_byte << 8

def byte2long(data1, data2, data3, data4):
    return data1 | data2 << 8 | data3 << 16 | data4 << 24

class IByte:
    def __init__(self, nIn):
        self.byLow = nIn & 0xff
        self.byHigh = (nIn >> 8) & 0xff

def int2byte(nIn):
    return IByte(nIn)
try:
    ser = serial.Serial(
        port = '/dev/ttyUSB0',
        baudrate = 19200,
        parity = serial.PARITY_NONE,
        stopbits = serial.STOPBITS_ONE,
        bytesize = serial.EIGHTBITS
    )

    if ser.isOpen():
        ser.close()
    ser.open()

except serial.SerialException as e:
    print("시리얼 포트를 열 수 없습니다.:", e)
    ser = None

def parse_command(command):
    controls = command.get("controls", {})
    w = controls.get("w", 0)
    s = controls.get("s", 0)
    a = controls.get("a", 0)
    d = controls.get("d", 0)

    linear = 0
    angular = 0

    if w == 1 and a == 0 and d == 0:
        linear = 7.0
        angular = 0
    if s == 1 and a == 0 and d == 0:
        linear = -7.0
        angular = 0
    if a == 1 and w == 0 and s == 0:
        linear = 0
        angular = -4.0
    if d == 1 and w == 0 and s == 0:
        linear = 0
        angular = 4.0
    if w == 1 and a == 1 and d == 0:
        linear = 3.5
        angular = -2.5
    if w == 1 and d == 1 and a == 0:
        linear = 3.5
        angular = 2.5
    if s == 1 and a == 1 and d == 0:
        linear = -3.5
        angular = -2.5
    if s == 1 and d == 1 and a == 0:
        linear = -3.5
        angular = 2.5

    print("linear:", linear, "angular:", angular)
    RobotSpeedToRPMSpeed(linear, angular)

    return goal_rpm_speed

goal_rpm_speed = np.zeros(2, dtype = np.int16)

def RobotSpeedToRPMSpeed(linear, angular):
    wheel_velocity_cmd = np.zeros(2)

    wheel_radius = 0.085
    wheel_separation = 0.68
    reduction = 1
    nMaxRPM = 200
    VELOCITY_CONSTANT_VALUE = 1

    wheel_velocity_cmd[0] = linear + (angular * wheel_separation / 2)
    wheel_velocity_cmd[1] = linear - (angular * wheel_separation / 2)

    wheel_velocity_cmd[0] = np.clip(wheel_velocity_cmd[0] * VELOCITY_CONSTANT_VALUE / wheel_radius * reduction, -nMaxRPM, nMaxRPM)
    wheel_velocity_cmd[1] = np.clip(wheel_velocity_cmd[1] * VELOCITY_CONSTANT_VALUE / wheel_radius * reduction, -nMaxRPM, nMaxRPM)

    # For 400T
    # goal_rpm_speed[0] = np.int16(wheel_velocity_cmd[0])
    # goal_rpm_speed[1] = np.int16(-wheel_velocity_cmd[1])  # Flip the sign to change direction

    # For 200T
    goal_rpm_speed[0] = np.int16(wheel_velocity_cmd[0])
    goal_rpm_speed[1] = np.int16(wheel_velocity_cmd[1])

def put_pnt_vel_cmd(ser, left_rpm, right_rpm):
    if ser is None:
        print("시리얼 포트가 연결되지 않았습니다.")
        return
    byD = bytearray(MAX_PACKET_SIZE)
    byDataNum = 7

    byD[0] = MOTOR_CONTROLLER_MACHINE_ID
    byD[1] = USER_MACHINE_ID
    byD[2] = ID
    byD[3] = PID_PNT_VEL_CMD
    byD[4] = byDataNum
    byD[5] = ENABLE
    left = int2byte(left_rpm)
    byD[6], byD[7] = left.byLow, left.byHigh
    byD[8] = ENABLE
    right = int2byte(right_rpm)
    byD[9], byD[10] = right.byLow, right.byHigh
    byD[11] = RETURN_PNT_MAIN_DATA
    byChkSum = sum(byD[0:12]) & 0xFF
    byD[12] = (byChkSum ^ 0xFF) + 1 & 0xFF

    for byte in byD:
        ser.write(struct.pack('B', byte))

sslcontext = ssl.create_default_context()
sslcontext.check_hostname = False
sslcontext.verify_mode = ssl.CERT_NONE

async def fetch(session, url):
    try:
        async with session.get(url, ssl = sslcontext) as response:
            response_text = await response.text()
            print(response_text)
            data = json.loads(response_text)

            rpm_speed = parse_command(data)
            put_pnt_vel_cmd(ser, rpm_speed[0], rpm_speed[1])
    except aiohttp.ClientError:
        print("인터넷 연결이 끊겼습니다. 모터 속도를 0으로 설정합니다.")
        put_pnt_vel_cmd(ser, rpm_speed[0], rpm_speed[1])
    
async def main():
    while True:
        async with aiohttp.ClientSession() as session:
            html = await fetch(session, 'https://52.78.20.133:3000/control')
            print(html)
            await asyncio.sleep(0.25)

loop = asyncio.get_event_loop()
loop.run_until_complete(main())
