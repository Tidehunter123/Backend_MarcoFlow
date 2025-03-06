import { supabase } from "../config/superbaseConfig";

interface QueryParams {
    page?: string;
    search?: string;
    mode?: string;
    sort?: string;
    tag_id?: string;
    tag_name?: string;
    is_nsfw?: string;
    user_id?: string;
}

interface CharacterDataResponse {
    characterData: any[];
    size: number;
    total: number | null;
}

// Define the parameter types for better type safety
interface CharacterParams {
    avatar: string;
    name: string;
    description: string;
    personality: string;
    scenario: string;
    example_dialogs: string;
    first_message: string;
    creator_id?: string;
    creator_name?: string;
    is_nsfw: boolean;
    is_public: boolean;
    tag_ids: number[];
    is_force_remove: boolean;
}

interface UpdateCharacterDataByIdArgs {
    params: CharacterParams;
    characterId: string;
}

const rowsPerPage = 20;

// Get specific character data
export const getCharactersAllData = async (queryParams: QueryParams): Promise<CharacterDataResponse> => {
    const { page, search, mode, tag_name, is_nsfw, user_id } = queryParams;
    const currentPage = parseInt(page || '1');
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage - 1;
    console.log(is_nsfw, "isnsfw", typeof (is_nsfw), user_id, typeof (user_id))
    // Function to create a base query with optional filters
    const createBaseQuery = async (): Promise<CharacterDataResponse> => {

        if (is_nsfw === "true") {
            let query = supabase
                .from("characters")
                .select(`*, character_tags(tags (id, name, join_name, slug))`, { count: 'exact' })
                .order('created_at', { ascending: false });
            ;

            if (user_id) {
                query = query
                    .or(`and(creator_id.eq.${user_id})`);
            } else {
                query = query.eq('is_public', true); // If no user_id, just filter by is_public=true
            }

            if (search) {
                query = query.ilike('name', `%${search}%`);
            }

            if (mode === "sfw") {
                query = query.eq('is_nsfw', false);
            } else if (mode === "nsfw") {
                query = query.eq('is_nsfw', true);
            }

            const { count } = await query;

            query = query.range(start, end);

            const { data, error} = await query;
            if (error) {

                console.log(error?.message)
                if (error?.message == "Requested range not satisfiable") {
                    return {
                        characterData: [],
                        size: rowsPerPage,
                        total: count,
                    };
                }
                else
                    throw new Error(`Error fetching character data: ${error.message}`);
            }

            console.log(data.length, 'count')

            return {
                characterData: data || [],
                size: rowsPerPage,
                total: count,
            };
        }
        else {
            let query = supabase
                .from("characters")
                .select(`*, character_tags!inner(tags!inner(id, name, join_name, Classification_of_Tag, slug))`)
                .not('is_nsfw', 'eq', true)
                .order('created_at', { ascending: false });

            if (user_id) {
                query = query
                    .or(`and(creator_id.eq.${user_id})`);
            } else {
                query = query.eq('is_public', true); // If no user_id, just filter by is_public=true
            }

            if (search) {
                query = query.ilike('name', `%${search}%`);
            }

            // query = query.range(start, end);

            // console.log(start,end,"start,end")

            const { data: sfwCharacters, error: sfwCharacterError } = await query;

            console.log("sfwCharacters", sfwCharacters?.length)

            console.log(is_nsfw, "isnsfw")
            if (sfwCharacterError) throw new Error(`Error fetching character data: ${sfwCharacterError.message}`);

            // Filter the array to exclude characters with any "NSFW" tag
            const filteredCharactersByNSFWTag = sfwCharacters.filter(character =>
                !character.character_tags.some((tag: { tags: { Classification_of_Tag: string; }; }) => tag.tags.Classification_of_Tag === "NSFW")
            );

            console.log(filteredCharactersByNSFWTag.length, "filteredCharacters.length");
            let Count: number | null = null; // Ensure the variable is initialized
            Count = filteredCharactersByNSFWTag.length
            return {
                characterData: filteredCharactersByNSFWTag.slice(start, end),
                size: rowsPerPage,
                total: Count !== null ? Count : 0,
            };
        }

    };

    // Fetch characters filtered by tag name if provided
    const fetchByTagName = async (): Promise<CharacterDataResponse> => {
        let query = supabase
            .from("characters")
            .select(`*, character_tags!inner(tags!inner(id, name, join_name,Classification_of_Tag,slug))`, { count: 'exact' })
            .ilike('character_tags.tags.join_name', tag_name!.toUpperCase())
            .order('created_at', { ascending: false });

        if (user_id) {
            query = query
                .or(`and(is_public.eq.true),and(is_public.eq.false,creator_id.eq.${user_id})`);
        } else {
            query = query.eq('is_public', true); // If no user_id, just filter by is_public=true
        }

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        if (mode === "sfw") {
            query = query.eq('is_nsfw', false);
        } else if (mode === "nsfw") {
            query = query.eq('is_nsfw', true);
        }

        query = query.range(start, end);



        let characterData;

        if (is_nsfw === "true") {
            const { data, error, count } = await query;

            if (error) throw new Error(`Error fetching character data: ${error.message}`);

            const filteredData = await Promise.all(
                data?.map(async (item) => {
                    const { data: innerData, error } = await supabase
                        .from("characters")
                        .select(`*, character_tags(tags (id, name, join_name))`, { count: "exact" })
                        .eq("id", `${item.id}`);

                    if (error) throw new Error(`Error fetching filtered character data: ${error.message}`);
                    return innerData || [];
                }) || []
            );

            console.log(filteredData.length, "filteredData.length")
            characterData = filteredData;
        }
        else {
            query = query.not('is_nsfw', 'eq', true);
            const { data, error, count } = await query;

            if (error) throw new Error(`Error fetching character data: ${error.message}`);

            const filteredData = await Promise.all(
                (data || []).map(async (item) => {
                    const { data: innerData, error } = await supabase
                        .from("characters")
                        .select(`
                            *,
                            character_tags (
                                tags (
                                    id,
                                    name,
                                    join_name,
                                    Classification_of_Tag, slug
                                )
                            )`,
                            { count: "exact" }
                        )
                        .eq("id", item.id); // Simplified item.id without template literal

                    if (error) throw new Error(`Error fetching filtered character data: ${error.message}`);
                    return innerData || []; // Ensures innerData is an array
                })
            );

            // Flatten the filtered data and filter out characters with NSFW tags
            characterData = filteredData.flat().filter(character =>
                character.character_tags && // Check that character_tags exists
                !character.character_tags.some((tag: { tags: { Classification_of_Tag: string; }; }) =>
                    tag.tags.Classification_of_Tag === "NSFW"
                )
            );
        }


        console.log(characterData.length, "character.length")

        return {
            characterData: characterData.flat(),
            size: rowsPerPage,
            total: characterData ? characterData.length : 0
        };
    };

    // Fetch characters with or without tag name filtering
    return tag_name ? await fetchByTagName() : await createBaseQuery();
};

export const creatingCharacterData = async (params: {
    avatar: string;
    name: string;
    description: string;
    personality: string;
    scenario: string;
    example_dialogs: string;
    first_message: string;
    creator_id?: string;
    creator_name?: string;
    is_nsfw: boolean;
    is_public: boolean;
    tag_ids: number[];
    is_force_remove: boolean;
}) => {
    const { data, error } = await supabase
        .from("characters")
        .insert({
            avatar: params.avatar,
            created_at: new Date(),
            name: params.name,
            creator_id: params.creator_id,
            creator_name: params.creator_name,
            description: params.description,
            personality: params.personality,
            scenario: params.scenario,
            example_dialogs: params.example_dialogs,
            first_message: params.first_message,
            is_nsfw: params.is_nsfw,
            is_public: params.is_public,
            is_force_remove: false,
            join_name: params.name,
        })
        .select();

    console.log(data, "data")
    if (error) {
        throw new Error(`Error updating character data: ${error.message}`);
    }

    if (data && params.tag_ids) {
        params.tag_ids.forEach(async tag_id => {
            const { data: tagData, error: tagError } = await supabase
                .from("character_tags")
                .insert({
                    character_id: data[0].id,
                    tag_id: tag_id,
                    created_at: new Date()
                })
                .select();
            console.log(tagData, tagError, "tagData or tagError")
        });
    }

    if (data) {
        const { data: reviewData, error: reviewError } = await supabase
            .from("reviews")
            .insert({
                character_id: data[0].id
            })
            .select();
        console.log(reviewData, reviewData, "tagData or tagError")
    }


    const { data: characterDataById, error: characterError } = await supabase
        .from("characters")
        .select(`*, character_tags(tags (id, name, join_name))`)
        .eq('id', data[0].id)

    if (characterError) {
        throw new Error(`Error fetching updated character data: ${characterError.message}`);
    }


    console.log(characterDataById, "characterDataById")

    return characterDataById[0];
}

export const getCharacterDataById = async (characterId: string, userId: any) => {

    let query = supabase.from("characters")
        .select(`*, character_tags(tags (id, name, join_name,slug))`)
        .eq('id', characterId)
        .single()
        ;
    const { data, error, count } = await query;
    if (error) {
        throw new Error(`Error fetching character data: ${error.message}`);
    }

    if ((data.is_public === false && data.creator_id === userId) || (data.is_public === true)) {
        console.log(data, "characterDataById")
        return data
    }

    else {
        throw new Error(`Error fetching character data: invalid user`);
    }

};

export const updateCharacterDataById = async ({
    params,
    characterId
}: UpdateCharacterDataByIdArgs) => {
    // Log inputs for debugging
    console.log("params:", params);
    console.log("characterId:", characterId);
    // Check if params and characterId are correctly defined
    if (!params || !characterId) {
        throw new Error("Missing required parameters or characterId");
    }
    // Update character data
    const { data, error } = await supabase
        .from("characters")
        .update({
            avatar: params.avatar,
            updated_at: new Date(),
            name: params.name,
            creator_id: params.creator_id,
            creator_name: params.creator_name,
            description: params.description,
            personality: params.personality,
            scenario: params.scenario,
            example_dialogs: params.example_dialogs,
            first_message: params.first_message,
            is_nsfw: params.is_nsfw,
            is_public: params.is_public,
        })
        .eq('id', characterId)
        .select();

    if (error) {
        throw new Error(`Error updating character data: ${error.message}`);
    }

    console.log("Updated character data:", data);

    // Delete existing tags if any
    if (data && data[0]) {
        const { data: deletedResult, error: deletedError } = await supabase
            .from("character_tags")
            .delete()
            .eq('character_id', characterId)
            .select();

        if (deletedError) {
            throw new Error(`Error deleting existing tags: ${deletedError.message}`);
        }

        console.log(deletedResult, "deletedResult");
    }

    // Insert new tags
    if (data && params.tag_ids?.length) {
        await Promise.all(params.tag_ids.map(async (tag_id: any) => {
            const { data: tagData, error: tagError } = await supabase
                .from("character_tags")
                .insert({
                    character_id: characterId,
                    tag_id: tag_id,
                    created_at: new Date()
                })
                .select();

            if (tagError) {
                throw new Error(`Error inserting tag: ${tagError.message}`);
            }

            console.log(tagData, "tagData");
        }));
    }

    // Fetch updated character data including tags (remove join_name if it doesn’t exist)
    const { data: characterDataById, error: characterError } = await supabase
        .from("characters")
        .select(`*, character_tags(tags (id, name))`)
        .eq('id', characterId);

    if (characterError) {
        throw new Error(`Error fetching updated character data: ${characterError.message}`);
    }

    console.log(characterDataById, "characterDataById");

    return characterDataById[0];
};

export const deleteCharacterDataById = async (characterId: string) => {
    console.log("characterId:", characterId);

    const { data: tagData, error: tagError } = await supabase
        .from("character_tags")
        .delete()
        .eq('character_id', characterId)
        .select()
    console.log(tagData, tagError, "tagData or tagError")
    if (tagError) {
        throw new Error(`Error deleting charactertag data: ${tagError.message}`);
    }

    const { data: chatData, error: chatError } = await supabase
        .from("chats")
        .delete()
        .eq('character_id', characterId)
        .select()
    console.log(chatData, chatError, "chatData")

    if (chatError) {
        throw new Error(`Error deleting charactertag data: ${chatError.message}`);
    }

    const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .delete()
        .eq('character_id', characterId)
        .select()
    console.log(reviewData, reviewError, "reviewData")

    if (reviewError) {
        throw new Error(`Error deleting charactertag data: ${reviewError.message}`);
    }

    const { data: reportData, error: reportError } = await supabase
        .from("user_reports")
        .delete()
        .eq('character_id', characterId)
        .select()
    console.log(reportData, reportError, "reportData")

    if (reportError) {
        throw new Error(`Error deleting charactertag data: ${reportError.message}`);
    }


    const { data, error } = await supabase
        .from("characters")
        .delete()
        .eq('id', characterId)
        .select()
    console.log(data, error, "data")

    // Assuming data is defined somewhere above
    if (data && data.length > 0) { // Check if data is not null and has elements
        const avatarPath = data[0].avatar; // Access the avatar path from the first object in the array

        const { data: deletedData, error } = await supabase.storage
            .from("cdn.venusai.chat")
            .remove([avatarPath]); // Wrap in an array

        if (error) {
            console.error("Error deleting avatar:", error.message);
        } else {
            console.log("Avatar deleted successfully:", deletedData);
        }
    } else {
        console.error("No avatar path found to delete or data is null.");
    }

    if (error) {
        throw new Error(`Error deleting character data: ${error.message}`);
    }
}


export const gettingSimilarCharacters = async (characterId: string, user_id: any, isNsfw: any) => {
    try {
        // Fetch the character data with tags
        const { data: characterData, error: characterError } = await supabase
            .from("characters")
            .select("*,character_tags(tags (id, name, join_name, slug))")
            .eq("id", characterId)
            .single();

        if (characterError || !characterData) {
            throw new Error(`Error fetching character data: ${characterError?.message || "No data found"}`);
        }

        // console.log("Character Data:", characterData);

        // Extract the character tags
        const characterTagNames = characterData.character_tags.map((characterTag: { tags: { join_name: string } }) => {
            return characterTag.tags.join_name;
        });

        // console.log("Character Tag Names:", characterTagNames);

        // Fetch all characters with tags
        // const { data: allCharacters, error: allCharactersError } = await supabase
        //     .from("characters")
        //     .select("*,character_tags(tags (id, name, join_name))")
        //     ;

        let query = supabase
            .from("characters")
            .select(`*, character_tags(tags (id, name, join_name, slug))`)

        if (user_id) {
            query = query
                .or(`and(is_public.eq.true),and(is_public.eq.false,creator_id.eq.${user_id})`);
        } else {
            query = query.eq('is_public', true); // If no user_id, just filter by is_public=true
        }

        const { data: allCharacters, error: allCharactersError } = await query;

        if (allCharactersError || !allCharacters) {
            throw new Error(`Error fetching all characters: ${allCharactersError?.message || "No data found"}`);
        }

        console.log("All Characters Count:", allCharacters.length);

        // Filter similar characters
        const similarCharacters = allCharacters
            ?.filter((character) => {
                const anotherCharacterTagNames = character.character_tags.map(
                    (characterTag: { tags: { join_name: string } }) => characterTag.tags.join_name
                );

                const commonTags = anotherCharacterTagNames.filter((tag: string) => characterTagNames.includes(tag));
                const hasCommonTags = commonTags.length >= 2;
                const isDifferentCharacter = character.id !== characterData.id;

                return hasCommonTags && isDifferentCharacter;
            })
            .map((filteredCharacter) => {
                // console.log("Filtered Character:", filteredCharacter);
                return filteredCharacter;
            });

        console.log("Similar Characters Count:", similarCharacters?.length);

        // Further filter based on NSFW flag if needed
        const isSFW_Characters = similarCharacters?.filter((character) => character.is_nsfw === false);

        console.log("SFW Characters Count:", isSFW_Characters?.length, isNsfw);
        if (isNsfw == "true") { return similarCharacters; }
        else {
            return isSFW_Characters;
        }
    } catch (error) {
        console.error("Error in gettingSimilarCharacters:", error);
        throw error;
    }
};




module.exports = { getCharactersAllData, creatingCharacterData, getCharacterDataById, updateCharacterDataById, deleteCharacterDataById, gettingSimilarCharacters }
