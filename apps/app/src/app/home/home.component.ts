import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component } from '@angular/core'
import { NgeMarkdownModule } from '@cisstech/nge/markdown'

@Component({
  standalone: true,
  selector: 'app-home',
  templateUrl: 'home.component.html',
  styleUrls: ['home.component.scss'],
  imports: [CommonModule, NgeMarkdownModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  protected readonly markdown = `
  <h1 align="center"> Nest KIT</h1>

  <div align="center">

  A collection of libraries for NestJS developers.

  [![CI](https://github.com/cisstech/nestkit/actions/workflows/ci.yml/badge.svg)](https://github.com/cisstech/nestkit/actions/workflows/ci.yml)
  [![codecov](https://codecov.io/gh/cisstech/nestkit/branch/main/graph/badge.svg)](https://codecov.io/gh/cisstech/nestkit)
  [![codefactor](https://www.codefactor.io/repository/github/cisstech/nestkit/badge/main)](https://www.codefactor.io/repository/github/cisstech/nestkit/overview/main)
  [![GitHub Tag](https://img.shields.io/github/tag/cisstech/nestkit.svg)](https://github.com/cisstech/nestkit/tags)
  [![licence](https://img.shields.io/github/license/cisstech/nestkit)](https://github.com/cisstech/nestkit/blob/main/LICENSE)
  [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

  </div>

  ## Packages

  | Package                                    | Description                                                  | Version                                                                                                                       |
  | ------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
  | [\`@cisstech/nestjs-expand\`](docs/nestjs-expand) | A NestJS module to build Dynamic Resource Expansion for APIs | [![version](https://img.shields.io/npm/v/@cisstech/nestjs-expand.svg)](https://www.npmjs.com/package/@cisstech/nestjs-expand) |
  | [\`@cisstech/nestjs-pg-pubsub\`](docs/nestjs-pg-pubsub) | Real-time PostgreSQL notifications using PubSub | [![version](https://img.shields.io/npm/v/@cisstech/nestjs-pg-pubsub.svg)](https://www.npmjs.com/package/@cisstech/nestjs-pg-pubsub) |

  ## 📄 Docs

  Documentation available at [https://cisstech.github.io/nestkit/](https://cisstech.github.io/nestkit/)

  ## ⌨️ Development

  - Clone and install

  \`\`\`bash
  git clone https://github.com/cisstech/nestkit
  cd nestkit
  yarn
  \`\`\`

  - Start docker

  \`\`\`bash
  docker-compose up -d
  \`\`\`

  - Serve demo

  \`\`\`bash
  yarn start
  \`\`\`


  - Documentation app will be serve at <http://localhost:4200/>.
  - Samples APIs documentations will be serve at <http://localhost:3000/api/doc>.

  ## 🤝 Contribution

  Contributions are always welcome. <br/>

  Please read our [CONTRIBUTING.md](https://github.com/cisstech/nestkit/blob/main/CONTRIBUTING.md) first. You can submit any ideas as [pull requests](https://github.com/cisstech/nestkit/pulls) or as [GitHub issues](https://github.com/cisstech/nestkit/issues).

  Please just make sure that ...

  Your code style matches with the rest of the project

  Unit tests pass

  Linter passes

  ## ❓ Support Development

  The use of this library is totally free.

  As the owner and primary maintainer of this project, I am putting a lot of time and effort beside my job, my family and my private time to bring the best support I can by answering questions, addressing issues and improving the library to provide more and more features over time.

  If this project has been useful, that it helped you or your business to save precious time, don't hesitate to give it a star to support its maintenance and future development.

  ## ✨ License

  MIT © [Mamadou Cisse](https://github.com/cisstech)
  `
}
