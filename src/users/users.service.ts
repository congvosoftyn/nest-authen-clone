import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException, } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DeviceSessionsService } from 'src/device-sessions/device-sessions.service';
import LoginDto from './dto/login.dto';
import SignUpDto from './dto/sign-up.dto';
import { UserEntity } from './user.entity';
import { LoginMetadata } from 'src/shared/interfaces/login-metadata.interface';

@Injectable()
export class UsersService {
  constructor(
    private deviceSessionsService: DeviceSessionsService,
  ) { }

  async hashPassword(password: string, salt: string): Promise<string> {
    return bcrypt.hash(password, salt);
  }

  async login(loginDto: LoginDto, metaData: LoginMetadata) {
    const { email, password } = loginDto;
    const user = await UserEntity.findOne({ where: { email } });

    if (!user || user.password !== (await this.hashPassword(password, user.salt))) {
      throw new UnauthorizedException('Email or password incorect');
    }
    return this.deviceSessionsService.handleDeviceSession(user.id, metaData,);
  }

  async signUp(signUpDto: SignUpDto) {
    const { email, password } = signUpDto;

    if (!!(await UserEntity.count({ where: { email: email } }))){
      throw new ConflictException('This email address is already used. Try a different email address.',);
    }

    const salt = await bcrypt.genSalt();
    const newUser = new UserEntity();
    newUser.email = email;
    newUser.salt = salt;
    newUser.password = await this.hashPassword(password, salt);
    return UserEntity.save(newUser);

  }
}
