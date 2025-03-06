import { supabase } from "../config/superbaseConfig"

// Get specific chararcters data
export const getTagsData = async () => {

    let query = supabase.from("tags")
        .select(`*`)
        .order('orderId', { ascending: true });
    ;
    const { data, error, count } = await query;
    if (error) {
        throw new Error(`Error fetching character data: ${error.message}`);
    }
    return data
};

module.exports = { getTagsData }