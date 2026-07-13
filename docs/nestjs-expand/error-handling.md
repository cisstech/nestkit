# Error Handling

The NestJS Expand library provides comprehensive error handling for expansion operations. This documentation explains how to configure error handling behavior and implement custom error handling strategies.

## Error Handling Policies

The library supports three error policies to control how expansion errors are handled:

- **ignore** (default): When an expansion fails, the expander is silently skipped and the request continues processing other expanders
- **include**: Error details are included in the response for debugging purposes
- **throw**: If any expansion fails, the entire request fails with an error response

### Setting Error Policies

You can set error policies at both the module level and the endpoint level:

```typescript
// Module level - applies to all endpoints
NestKitExpandModule.forRoot({
  errorHandling: {
    defaultErrorPolicy: 'include',
    includeErrorsInResponse: true
  }
})

// Endpoint level - overrides module level for specific endpoint
@Get('users')
@Expandable(UserDTO, { errorPolicy: 'throw' })
findAll() {
  return this.userService.findAll();
}
```

## Including Error Details in Responses

When `includeErrorsInResponse` is set to `true` and policy is either `ignore` or `include`, error details are attached to the response:

For single objects, errors are added as an `_expansionErrors` property:

```json
{
  "id": 1,
  "name": "John Doe",
  "email": "john@example.com",
  "_expansionErrors": {
    "UserDTO.profile": {
      "message": "Profile not found",
      "path": "UserDTO.profile"
    }
  }
}
```

For array responses, errors are attached to individual items that caused them:

```json
[
  {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "profile": {
      "id": 1,
      "bio": "Software developer"
    }
  },
  {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "_expansionErrors": {
      "UserDTO.profile": {
        "message": "Profile not found",
        "path": "UserDTO.profile[1]"
      }
    }
  }
]
```

## Customizing Error Format

You can customize how errors are formatted in responses using the `errorResponseShape` function:

```typescript
NestKitExpandModule.forRoot({
  errorHandling: {
    includeErrorsInResponse: true,
    errorResponseShape: (error, path) => ({
      message: `Failed to expand ${path.split('.').pop()}: ${error.message}`,
      code: error.code || 'EXPANSION_ERROR',
      timestamp: new Date().toISOString(),
      path: path,
    }),
  },
})
```

## Handling Root Field Errors

When using the `rootField` option, error handling works as expected with errors being attached to the items within the root field:

```typescript
@Get('users/paged')
@Expandable(UserDTO, { rootField: 'items' })
findPaged() {
  return {
    items: this.userService.findAll(),
    total: 100,
    page: 1
  };
}
```

Example response:

```json
{
  "items": [
    {
      "id": 1,
      "name": "John Doe",
      "profile": { "bio": "Developer" }
    },
    {
      "id": 2,
      "name": "Jane Smith",
      "_expansionErrors": {
        "UserDTO.profile": {
          "message": "Profile not found",
          "path": "UserDTO.profile[1]"
        }
      }
    }
  ],
  "total": 100,
  "page": 1
}
```

## Logging Configuration

You can control the verbosity of error logging with the `logLevel` option:

```typescript
NestKitExpandModule.forRoot({
  logLevel: 'warn', // 'debug' | 'log' | 'warn' | 'error' | 'none'
  // other config...
})
```

## Complete Example

Here's a complete example showing multiple error handling strategies:

```typescript
// app.module.ts
@Module({
  imports: [
    NestKitExpandModule.forRoot({
      enableLogging: true,
      logLevel: 'warn',
      errorHandling: {
        includeErrorsInResponse: true,
        defaultErrorPolicy: 'ignore',
        errorResponseShape: (error, path) => ({
          message: error.message,
          path: path,
          timestamp: new Date().toISOString(),
        }),
      },
    }),
  ],
  // other config...
})
export class AppModule {}

// user.controller.ts
@Controller('users')
export class UserController {
  @Get()
  @Expandable(UserDTO) // Uses default error policy
  findAll() {
    return this.userService.findAll()
  }

  @Get('safe')
  @Expandable(UserDTO, { errorPolicy: 'ignore' })
  findSafe() {
    return this.userService.findAll()
  }

  @Get('debug')
  @Expandable(UserDTO, { errorPolicy: 'include' })
  findWithErrorInfo() {
    return this.userService.findAll()
  }

  @Get('strict')
  @Expandable(UserDTO, { errorPolicy: 'throw' })
  findStrict() {
    return this.userService.findAll()
  }
}
```

With these configurations, you have complete control over how expansion errors are handled, logged, and presented to API consumers.
