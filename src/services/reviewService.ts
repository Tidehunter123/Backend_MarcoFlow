
import { supabase } from "../config/superbaseConfig"

interface PostParams {
    character_id?: string;
    content?: string;
    is_like?: boolean;
    user_id?: string;
}

// Get specific chararcters data
export const getReviewsDataByCharacterId = async (characterId: string) => {

    let query = supabase.from("reviews")
        .select(`*, user_profiles(avatar, name, user_name)`)
        .eq('character_id', characterId)
        ;
    const { data, error, count } = await query;
    if (error) {
        throw new Error(`Error fetching character data: ${error.message}`);
    }

    console.log(data, "reviewDataById")
    return data
};

export const postReviewsDataByCharacterId = async (params: PostParams) => {

    let query = supabase.from("reviews")
        .update({
            created_at: new Date(),
            content: params.content,
            is_like: params.is_like,
        })
        .eq('user_id', params.user_id)
        .eq('character_id', params.character_id)
        .select(`*, user_profiles(avatar, name, user_name)`)
        ;
    const { data: updatedData, error: updatedError } = await query;
    if (updatedError) {
        throw new Error(`Error fetching character data: ${updatedError.message}`);
    }

    if (!updatedData[0]) {
        let query = supabase.from("reviews")
            .insert({
                created_at: new Date(),
                content: params.content,
                is_like: params.is_like,
                user_id: params.user_id,
                character_id: params.character_id
            })
            .select(`*, user_profiles(avatar, name, user_name)`)
            ;
        const { data: createdData, error: createdError } = await query;
        if (createdError) {
            throw new Error(`Error fetching character data: ${createdError.message}`);
        }
        console.log(createdData, "createdData")
        return createdData[0]
    }
    else {
        console.log(updatedData, "updatedreviewDataById")
        return updatedData[0]
    }
};

module.exports = { getReviewsDataByCharacterId, postReviewsDataByCharacterId }