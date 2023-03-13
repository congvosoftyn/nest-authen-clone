import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DeviceSessionsModule } from './device-sessions/device-sessions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'mariadb',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'admin123',
      database: 'DBAuthen',
      charset: 'utf8mb4',
      entities: [__dirname + '/**/**.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
      keepConnectionAlive: true,
      // ssl: true,
    }),
    UsersModule,
    DeviceSessionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
