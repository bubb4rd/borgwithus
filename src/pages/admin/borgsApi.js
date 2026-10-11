import { supabase } from "../../lib/supabase";

// Borgs tab data: public.borgs through admin-only functions (is_borg_admin()), defined in
// supabase/migrations/20261018000000_borg_catalog.sql.
//
//   admin_list_borgs() -> [{ id, name, original, source: "classic" | "member" | "ai", category,
//                            featured, created_at, updated_at, author, likes, dislikes, rolls }]
//     author: member names only, their display name or the first 8 characters of their account id
//   admin_save_borg(p_id, p_name, p_original, p_category, p_featured) -> id
//     p_id null adds a classic. Renames carry likes and 👎s; a member name's submission is renamed
//     too. A name already on the board is a unique_violation (23505).
//   admin_delete_borgs(p_ids) -> removed     member names' submissions are marked rejected
//   admin_set_borg_category(p_ids, p_category) -> changed     blank clears
//   admin_set_borg_featured(p_ids, p_featured) -> changed

async function rpc(name, args) {
  const { data: result, error } = await supabase.rpc(name, args);
  if (error) {
    throw new Error(error.code === "23505" ? "Another borg already has that name." : error.message || "Request failed");
  }
  return result;
}

export const listBorgs = async () => (await rpc("admin_list_borgs")) ?? [];

export const saveBorg = ({ id = null, name, original, category, featured }) =>
  rpc("admin_save_borg", {
    p_id: id,
    p_name: name,
    p_original: original,
    p_category: category,
    p_featured: featured,
  });

export const deleteBorgs = (ids) => rpc("admin_delete_borgs", { p_ids: ids });

export const setCategory = (ids, category) => rpc("admin_set_borg_category", { p_ids: ids, p_category: category });

export const setFeatured = (ids, featured) => rpc("admin_set_borg_featured", { p_ids: ids, p_featured: featured });
