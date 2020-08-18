import { Injectable } from "@nestjs/common";
import { Cron } from "nest-schedule";
import { getCronExpressionForMemezatorCompetitionSumminUpCron, delay } from "./utils";
import { StatusesRepository } from "../statuses/StatusesRepository";
import { HashTagsRepository } from "../statuses/HashTagsRepository";
import _ from "lodash"
import { EtherscanService } from "../etherscan";
import { StatusLikesRepository } from "../statuses/StatusLikesRepository";
import { MEMEZATOR_HASHTAG } from "../common/constants"
import { WinnerMemesWithLikes, MemeWithLikesAndVotingPowers, LikeAndVotingPower } from "./types";

@Injectable()
export class MemezatorService {
  constructor(
    private readonly statusesRepository: StatusesRepository,
    private readonly hashTagRepository: HashTagsRepository,
    private readonly etherscanService: EtherscanService,
    private readonly statusLikeRepository: StatusLikesRepository
  ) {}

  @Cron(getCronExpressionForMemezatorCompetitionSumminUpCron())
  async memezatorCompetitionSummingUpCron(): Promise<void> {}
  
  async startMemezatorCompetitionSummingUp(): Promise<WinnerMemesWithLikes> {
    const winners = await this.findWinnerMemesWithLikes()

    return winners
  }

  async findWinnerMemesWithLikes(): Promise<WinnerMemesWithLikes> {
    const lastMidnightInGreenwich = this.getLastMidnightInGreenwich()

    const memezatorHashTag = await this.hashTagRepository.findOneByName(MEMEZATOR_HASHTAG)

    // Memes created after last greenwich midnight
    const memes = await this.statusesRepository.findByHashTagAndCreatedAtAfter(memezatorHashTag, lastMidnightInGreenwich)

    let firstPlace: MemeWithLikesAndVotingPowers | null = null
    let secondPlace: MemeWithLikesAndVotingPowers | null = null
    let thirdPlace: MemeWithLikesAndVotingPowers | null = null

    for (const meme of memes) {
      const likes = await this.statusLikeRepository.findByStatus(meme)
      const likesChunks = _.chunk(likes, 20)
      const likesWithVotingPowers: LikeAndVotingPower[] = []
      let votes = 0

      for (const likesChunk of likesChunks) {
        const usersBalances = await this.etherscanService.getBalancesOnMultipleAccounts(likesChunk.map(like => like.user.ethereumAddress))
        const votingPowers = usersBalances.map(userBalance => this.calculateVotingPower(userBalance.balance))

        likesWithVotingPowers.push(...likesChunk.map((like, i) => ({ like, votingPower: votingPowers[i] })))

        votes += _.sum(votingPowers)
        await delay(200)
      }

      meme.favoritesCount = votes
      await this.statusesRepository.save(meme)

      if (!firstPlace || votes > firstPlace.meme.favoritesCount) {
        firstPlace = { meme, likesWithVotingPowers }
      } else if (!secondPlace || votes > secondPlace.meme.favoritesCount) {
        secondPlace = { meme, likesWithVotingPowers }
      } else if (!thirdPlace || votes > thirdPlace.meme.favoritesCount) {
        thirdPlace = { meme, likesWithVotingPowers }
      }
    }

    return {
      firstPlace,
      secondPlace,
      thirdPlace
    }
  }

  calculateVotingPower(balance: string): number {
    if (BigInt(balance) < BigInt(2)) {
      return 0
    } else if (BigInt(balance) < BigInt(5000)) {
      return 40
    } else {
      return 80
    }
  }

  getLastMidnightInGreenwich(): Date {
    const midnightInGreenwich = new Date()
    midnightInGreenwich.setUTCHours(0, 0, 0, 0)

    return midnightInGreenwich
  }
}
