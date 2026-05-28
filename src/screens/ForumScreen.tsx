import React from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import apiClient from '../services/apiClient';

type Post = {
  id: number;
  title: string;
  body: string;
  species?: string;
  breed?: string;
  author_id?: string;
};

type Answer = {
  id: number;
  body: string;
  author_id?: string;
  verified: boolean;
  votes: number;
};

export default function ForumScreen() {
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [species, setSpecies] = React.useState('');
  const [breed, setBreed] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [selectedPost, setSelectedPost] = React.useState<Post | null>(null);
  const [answers, setAnswers] = React.useState<Answer[]>([]);
  const [answerBody, setAnswerBody] = React.useState('');
  const [answerLoading, setAnswerLoading] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);

  React.useEffect(() => {
    void loadPosts();
  }, []);

  async function loadPosts(queryString = '') {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/forum/posts', {
        params: { search: queryString, top: 'true' },
      });
      setPosts(res.data.posts ?? []);
    } catch (e) {
      // ignore for now
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Missing fields', 'Please enter both a title and description.');
      return;
    }

    try {
      const res = await apiClient.post('/api/forum/posts', {
        title: title.trim(),
        body: body.trim(),
        species: species.trim() || null,
        breed: breed.trim() || null,
        author_id: 'anonymous',
      });
      if (res.data?.post) setPosts((p) => [res.data.post, ...p]);
      setTitle('');
      setBody('');
      setSpecies('');
      setBreed('');
    } catch (e) {
      Alert.alert('Post failed', 'Unable to create forum question.');
    }
  }

  async function openPost(post: Post) {
    setModalVisible(true);
    setSelectedPost(post);
    try {
      const res = await apiClient.get(`/api/forum/posts/${post.id}`);
      setAnswers(res.data.answers ?? []);
    } catch (e) {
      Alert.alert('Unable to load answers', 'Please try again later.');
    }
  }

  async function handleAnswer() {
    if (!selectedPost || !answerBody.trim()) return;
    setAnswerLoading(true);
    try {
      const res = await apiClient.post(`/api/forum/posts/${selectedPost.id}/answers`, {
        body: answerBody.trim(),
        author_id: 'anonymous',
        verified: false,
      });
      if (res.data?.answer) setAnswers((prev) => [res.data.answer, ...prev]);
      setAnswerBody('');
    } catch (e) {
      Alert.alert('Answer failed', 'Unable to submit answer.');
    } finally {
      setAnswerLoading(false);
    }
  }

  async function vote(answerId: number, delta: 1 | -1) {
    try {
      await apiClient.post(`/api/forum/answers/${answerId}/vote`, {
        user_id: 'anonymous',
        delta,
      });
      setAnswers((prev) =>
        prev.map((answer) =>
          answer.id === answerId ? { ...answer, votes: answer.votes + delta } : answer,
        ),
      );
    } catch {
      Alert.alert('Vote failed', 'Unable to apply your vote.');
    }
  }

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity style={styles.post} onPress={() => openPost(item)}>
      <View style={styles.postHeader}>
        <Text style={styles.postTitle}>{item.title}</Text>
        <View style={styles.tagRow}>
          {item.species ? <Text style={styles.tag}>{item.species}</Text> : null}
          {item.breed ? <Text style={styles.tag}>{item.breed}</Text> : null}
        </View>
      </View>
      <Text style={styles.postBody} numberOfLines={3}>
        {item.body}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Community Forum</Text>
      <TextInput
        value={search}
        onChangeText={(text) => {
          setSearch(text);
          void loadPosts(text);
        }}
        placeholder="Search top questions"
        style={styles.input}
      />

      <View style={styles.form}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Question title"
          style={styles.input}
        />
        <TextInput
          value={species}
          onChangeText={setSpecies}
          placeholder="Species (e.g. dog, cat)"
          style={styles.input}
        />
        <TextInput
          value={breed}
          onChangeText={setBreed}
          placeholder="Breed"
          style={styles.input}
        />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Describe your question"
          style={[styles.input, styles.textArea]}
          multiline
        />
        <TouchableOpacity style={styles.btn} onPress={handleCreate}>
          <Text style={styles.btnText}>Post Question</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={() => void loadPosts(search)}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No questions yet.</Text>}
      />

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedPost?.title}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.postBody}>{selectedPost?.body}</Text>
            <Text style={styles.sectionTitle}>Answers</Text>
            {answers.map((answer) => (
              <View key={answer.id} style={styles.answerCard}>
                <View style={styles.answerHeader}>
                  <Text style={styles.answerMeta}>{answer.verified ? 'Verified vet' : 'Community'}</Text>
                  <Text style={styles.answerVotes}>Votes: {answer.votes}</Text>
                </View>
                <Text style={styles.answerBody}>{answer.body}</Text>
                <View style={styles.voteControls}>
                  <TouchableOpacity onPress={() => vote(answer.id, 1)} style={styles.voteButton}>
                    <Text style={styles.voteText}>Upvote</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => vote(answer.id, -1)} style={styles.voteButton}>
                    <Text style={styles.voteText}>Downvote</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={styles.sectionTitle}>Post an answer</Text>
            <TextInput
              value={answerBody}
              onChangeText={setAnswerBody}
              style={[styles.input, styles.textArea]}
              placeholder="Write your answer"
              multiline
              editable={!answerLoading}
            />
            <TouchableOpacity style={styles.btn} onPress={handleAnswer} disabled={answerLoading}>
              <Text style={styles.btnText}>{answerLoading ? 'Submitting…' : 'Submit Answer'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  header: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 10 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  form: { marginBottom: 16 },
  btn: { backgroundColor: '#1976D2', padding: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  listContent: { paddingBottom: 24 },
  post: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, marginBottom: 12, backgroundColor: '#fafafa' },
  postHeader: { marginBottom: 8 },
  postTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  postBody: { fontSize: 14, color: '#333', marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap' },
  tag: { backgroundColor: '#e3f2fd', color: '#0d47a1', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 6, marginBottom: 6 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 24 },
  modalContainer: { flex: 1, padding: 16, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', flex: 1, marginRight: 12 },
  closeText: { color: '#1976D2', fontWeight: '700' },
  modalBody: { flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  answerCard: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: '#fdfdfd' },
  answerHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  answerMeta: { fontSize: 12, color: '#555' },
  answerVotes: { fontSize: 12, color: '#555' },
  voteControls: { flexDirection: 'row' },
  voteButton: { backgroundColor: '#e3f2fd', padding: 8, borderRadius: 8, marginRight: 10 },
  voteText: { color: '#1976D2', fontWeight: '700' },
});
