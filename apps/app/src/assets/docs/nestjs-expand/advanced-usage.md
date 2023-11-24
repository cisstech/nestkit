# Advanced Usage

## Configuration Options

The library provides configuration options to customize its behavior. You can pass an optional configuration object when initializing the ExpandService in your module.

```typescript
// app.module.ts

import { Module } from '@nestjs/common'
import { NestKitExpandModule } from '@cisstech/nestjs-expand'
import { UserExpander } from 'PATH_TO_FILE'
import { UserController } from 'PATH_TO_FILE'

@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: false,
      expandQueryParamName: 'expands',
    }),
  ],
  controllers: [UserController],
  providers: [UserExpander],
})
export class AppModule {}
```
