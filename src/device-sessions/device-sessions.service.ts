import { CACHE_MANAGER, ForbiddenException, Inject, Injectable, UnauthorizedException, } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Cache } from 'cache-manager';
import * as randomatic from 'randomatic';
import AuthService from 'src/auth/auth.service';
import { JwtStrategy } from 'src/auth/guard/jwt.strategy';
import addDay from 'src/shared/helpers/addDay';
import DeviceSessionEntity from './device-session.entity';
import { LoginMetadata } from 'src/shared/interfaces/login-metadata.interface';
import { LoginRespionse } from 'src/shared/interfaces/login-response.interface';
const { randomUUID } = require('crypto');
const EXP_SESSION = 7; // 1 week


@ApiBearerAuth()
@Injectable()
export class DeviceSessionsService {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,

    private authService: AuthService,
  ) { }

  generateSecretKey(length = 16) {
    return randomatic('A0', length);
  }

  async logout(userId: string, sessionId: string) {
    const session: any = await DeviceSessionEntity
      .createQueryBuilder('session')
      .leftJoinAndSelect('session.user', 'user')
      .select(['session', 'user.id'])
      .where('session.id = :sessionId', { sessionId })
      .getOne();

    if (!session || session.user.id !== userId) {
      throw new ForbiddenException();
    }
    const keyCache = this.authService.getKeyCache(userId, session.deviceId);

    this.cacheManager.set(keyCache, null);
    DeviceSessionEntity.delete(sessionId);

    return { message: 'Logout success', status: 200, sessionId, };
  }

  async reAuth(deviceId: string, _refreshToken: string,): Promise<LoginRespionse> {
    const session = await DeviceSessionEntity
      .createQueryBuilder('session')
      .select('session', 'user.id')
      .leftJoinAndSelect('session.user', 'user')
      .where('session.refreshToken = :_refreshToken', { _refreshToken })
      .andWhere('session.deviceId = :deviceId', { deviceId })
      .getOne();

    if (!session || new Date(session.expiredAt).valueOf() < new Date().valueOf()) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    const payload = { id: session.user.id, deviceId, };

    const secretKey = this.generateSecretKey();
    const [token, refreshToken, expiredAt] = [JwtStrategy.generate(payload, secretKey), randomatic('Aa0', 64), addDay(7),];

    DeviceSessionEntity.update(session.id, { secretKey, refreshToken, expiredAt, });
    return { token, refreshToken, expiredAt };
  }

  async handleDeviceSession(userId: string, metaData: LoginMetadata): Promise<LoginRespionse> {
    const { deviceId } = metaData;
    const currentDevice = await DeviceSessionEntity.findOne({ where: { deviceId } });

    const expiredAt = addDay(EXP_SESSION);
    const secretKey = this.generateSecretKey();

    const payload = { id: userId, deviceId, };
    const [token, refreshToken] = [JwtStrategy.generate(payload, secretKey), randomatic('Aa0', 64),];

    const deviceName = metaData.deviceId;
    const newDeviceSession = new DeviceSessionEntity();
    newDeviceSession.userId = userId;
    newDeviceSession.secretKey = secretKey;
    newDeviceSession.refreshToken = refreshToken;
    newDeviceSession.expiredAt = expiredAt;
    newDeviceSession.deviceId = deviceId;
    newDeviceSession.ipAddress = metaData.ipAddress;
    newDeviceSession.ua = metaData.ua;
    newDeviceSession.name = deviceName;

    // update or create device session
    DeviceSessionEntity.save({ id: currentDevice?.id || randomUUID(), ...newDeviceSession, });
    return { token, refreshToken, expiredAt };
  }

  getDeviceSessions(userId: string) {
    return DeviceSessionEntity.find({
      where: { userId: userId, },
      select: ['id', 'deviceId', 'createdAt', 'ipAddress', 'name', 'ua', 'expiredAt', 'updatedAt',],
    });
  }
}
