import {Injectable} from "@nestjs/common";
import uuid from "uuid/v4";
import {SignUpReferencesRepository} from "./SignUpReferencesRepository";
import {UsersRepository} from "./UsersRepository";
import {SignUpReferencesMapper} from "./SignUpReferencesMapper";
import {CreateSignUpReferenceRequest} from "./types/request";
import {SignUpReferenceResponse} from "./types/response";
import {User} from "./entities";
import {SignUpReference} from "./entities/SignUpReference";
import {asyncMap} from "../utils/async-map";

@Injectable()
export class SignUpReferencesService {
    constructor(private readonly signUpReferenceRepository: SignUpReferencesRepository,
                private readonly usersRepository: UsersRepository,
                private readonly signUpReferencesMapper: SignUpReferencesMapper) {
    }

    public async createSignUpReference(createSignUpReferenceRequest: CreateSignUpReferenceRequest,
                                       currentUser: User): Promise<SignUpReferenceResponse> {
        let signUpReference: SignUpReference = {
            id: uuid(),
            registeredUsersCount: 0,
            maxUses: createSignUpReferenceRequest.maxUses,
            createdBy: currentUser,
            expiresAt: createSignUpReferenceRequest.expiresAt,
            createdAt: new Date(),
            config: createSignUpReferenceRequest.config
        };
        signUpReference = await this.signUpReferenceRepository.save(signUpReference);

        return await this.signUpReferencesMapper.toSignUpReferenceResponse(signUpReference, currentUser);
    }

    public async findAllSignUpReferences(currentUser: User): Promise<SignUpReferenceResponse[]> {
        const signUpReferences = await this.signUpReferenceRepository.findAll();

        return asyncMap(
            signUpReferences,
            async signUpReference => await this.signUpReferencesMapper.toSignUpReferenceResponse(signUpReference, currentUser)
        );
    }
}