/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, LogLevel, ValidationPipe, VersioningType } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'

import { AppModule } from './app/app.module'

const LOG_LEVELS: LogLevel[] =
  process.env['NODE_ENV'] === 'development' ? ['debug', 'error', 'log', 'verbose', 'warn'] : ['error', 'warn']

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
    logger: LOG_LEVELS,
  })

  const globalPrefix = 'api'
  app.setGlobalPrefix(globalPrefix)

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  })

  const config = new DocumentBuilder()
    .setTitle('NestKIT API')
    .setDescription('The NestKIT API description')
    .setVersion('1.0')
    .addTag('nestkit')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/doc', app, document)

  app.useLogger(app.get(Logger))
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: false,
      transform: true,
    })
  )

  const port = process.env['PORT'] || 3000
  await app.listen(port)

  Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`)
}

bootstrap()
